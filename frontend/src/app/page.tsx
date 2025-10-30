import Carousel from "@/components/Carousel";
import Features from "@/components/Features";
import Summary from "@/components/Summary";
import Footer from "@/components/Footer";

export default function DashboardPage() {
  return (
    <main>
      {/* Full-page hero carousel */}
      <section className="fullbleed">
        <Carousel />
      </section>

      {/* App sections below, fluid and responsive */}
      <div className="container">
        <Features />
        <Summary />
        <Footer />
      </div>
    </main>
  );
}
