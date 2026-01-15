"""
Custom exception handler and middleware for comprehensive error handling.
Place this in a new file: budgetapi/exceptions.py
"""

from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from django.db import DatabaseError, IntegrityError
from rest_framework.exceptions import (
    APIException,
    AuthenticationFailed,
    NotAuthenticated,
    PermissionDenied,
    NotFound,
    ValidationError,
    ParseError,
    MethodNotAllowed,
    NotAcceptable,
    UnsupportedMediaType,
    Throttled
)
import logging

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Custom exception handler that provides consistent error responses.
    """
    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)
    
    # Get the view and request from context
    view = context.get('view', None)
    request = context.get('request', None)
    
    # Log the exception
    if view:
        view_name = view.__class__.__name__
    else:
        view_name = 'Unknown'
    
    # Handle specific exception types
    if isinstance(exc, NotAuthenticated):
        logger.warning(f"Unauthenticated access attempt to {view_name}")
        return Response({
            'detail': 'Authentication credentials were not provided',
            'error_code': 'not_authenticated'
        }, status=status.HTTP_401_UNAUTHORIZED)
    
    elif isinstance(exc, AuthenticationFailed):
        logger.warning(f"Authentication failed for {view_name}: {str(exc)}")
        return Response({
            'detail': 'Invalid authentication credentials',
            'error_code': 'authentication_failed'
        }, status=status.HTTP_401_UNAUTHORIZED)
    
    elif isinstance(exc, PermissionDenied):
        logger.warning(f"Permission denied for {view_name}: {str(exc)}")
        return Response({
            'detail': 'You do not have permission to perform this action',
            'error_code': 'permission_denied'
        }, status=status.HTTP_403_FORBIDDEN)
    
    elif isinstance(exc, NotFound) or isinstance(exc, Http404):
        return Response({
            'detail': str(exc) if str(exc) else 'Resource not found',
            'error_code': 'not_found'
        }, status=status.HTTP_404_NOT_FOUND)
    
    elif isinstance(exc, ValidationError):
        logger.info(f"Validation error in {view_name}: {exc.detail}")
        return Response({
            'detail': exc.detail,
            'error_code': 'validation_error'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    elif isinstance(exc, DjangoValidationError):
        logger.info(f"Django validation error in {view_name}: {str(exc)}")
        return Response({
            'detail': str(exc),
            'error_code': 'validation_error'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    elif isinstance(exc, ParseError):
        logger.warning(f"Parse error in {view_name}: {str(exc)}")
        return Response({
            'detail': 'Malformed request data',
            'error_code': 'parse_error'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    elif isinstance(exc, MethodNotAllowed):
        logger.warning(f"Method not allowed in {view_name}: {str(exc)}")
        return Response({
            'detail': f'Method {request.method} not allowed',
            'error_code': 'method_not_allowed'
        }, status=status.HTTP_405_METHOD_NOT_ALLOWED)
    
    elif isinstance(exc, NotAcceptable):
        return Response({
            'detail': 'Could not satisfy the request Accept header',
            'error_code': 'not_acceptable'
        }, status=status.HTTP_406_NOT_ACCEPTABLE)
    
    elif isinstance(exc, UnsupportedMediaType):
        return Response({
            'detail': f'Unsupported media type {request.content_type}',
            'error_code': 'unsupported_media_type'
        }, status=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE)
    
    elif isinstance(exc, Throttled):
        logger.warning(f"Rate limit exceeded for {view_name}")
        return Response({
            'detail': f'Request was throttled. Try again in {exc.wait} seconds',
            'error_code': 'throttled',
            'retry_after': exc.wait
        }, status=status.HTTP_429_TOO_MANY_REQUESTS)
    
    elif isinstance(exc, IntegrityError):
        logger.error(f"Database integrity error in {view_name}: {str(exc)}")
        return Response({
            'detail': 'Database integrity error. This might be a duplicate entry',
            'error_code': 'integrity_error'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    elif isinstance(exc, DatabaseError):
        logger.error(f"Database error in {view_name}: {str(exc)}")
        return Response({
            'detail': 'A database error occurred. Please try again later',
            'error_code': 'database_error'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    # Handle other DRF exceptions
    elif response is not None:
        # Add error_code to response
        if isinstance(exc, APIException):
            response.data['error_code'] = exc.default_code
        return response
    
    # Handle unexpected exceptions
    else:
        logger.error(f"Unhandled exception in {view_name}: {str(exc)}", exc_info=True)
        return Response({
            'detail': 'An unexpected error occurred. Please try again later',
            'error_code': 'internal_server_error'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ErrorLoggingMiddleware:
    """
    Middleware to log all exceptions and provide consistent error responses.
    Add this to MIDDLEWARE in settings.py
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        response = self.get_response(request)
        return response
    
    def process_exception(self, request, exception):
        """
        Process exceptions that occur during request processing.
        """
        # Log the exception
        logger.error(
            f"Exception during {request.method} {request.path}: {str(exception)}",
            exc_info=True,
            extra={
                'request_method': request.method,
                'request_path': request.path,
                'user': getattr(request.user, 'id', None),
                'ip_address': self.get_client_ip(request)
            }
        )
        
        # Let Django's exception handling continue
        return None
    
    @staticmethod
    def get_client_ip(request):
        """Get the client's IP address from the request."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class DatabaseConnectionMiddleware:
    """
    Middleware to handle database connection issues gracefully.
    Add this to MIDDLEWARE in settings.py
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        try:
            response = self.get_response(request)
            return response
        except DatabaseError as e:
            logger.error(f"Database connection error: {str(e)}")
            return Response({
                'detail': 'Service temporarily unavailable. Please try again later',
                'error_code': 'service_unavailable'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)


# Custom exception classes
class ServiceUnavailableError(APIException):
    """Exception for service unavailability (503)"""
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = 'Service temporarily unavailable'
    default_code = 'service_unavailable'


class BadGatewayError(APIException):
    """Exception for bad gateway errors (502)"""
    status_code = status.HTTP_502_BAD_GATEWAY
    default_detail = 'Bad gateway error occurred'
    default_code = 'bad_gateway'


class ResourceConflictError(APIException):
    """Exception for resource conflicts (409)"""
    status_code = status.HTTP_409_CONFLICT
    default_detail = 'Resource conflict occurred'
    default_code = 'resource_conflict'


class RateLimitExceededError(APIException):
    """Exception for rate limit exceeded (429)"""
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    default_detail = 'Too many requests'
    default_code = 'rate_limit_exceeded'