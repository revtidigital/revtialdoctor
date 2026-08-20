import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";

export const Route = createFileRoute("/rules")({
  component: RulesPage,
});

function RulesPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-4xl md:text-5xl font-black text-garnet">
          Revital Energy Challenge — Game Rules
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: {new Date().toLocaleDateString()}
        </p>

        <div className="prose prose-sm md:prose-base mt-8 space-y-5 text-garnet/85">
          <section>
            <h2 className="text-xl font-bold text-garnet">General Energy Rank Bands (All Games)</h2>
            <ul>
              <li>S / Peak Performer: ≥ 80%</li>
              <li>A / High Energy: ≥ 60%</li>
              <li>B / Charged Up: ≥ 40%</li>
              <li>C / Warming Up: ≥ 20%</li>
              <li>D / Recharge Needed: &lt; 20%</li>
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">1. Focus Reflex Test</h2>
            <ul>
              <li>Objective: Tap/click as quickly as possible when the logo appears.</li>
              <li>Reaction time is measured in milliseconds (ms).</li>
              <li>The faster the reaction, the higher the score.</li>
              <li>Maximum Score: 1500 points for fastest response.</li>
              <li>Minimum Score: 0 points for slowest response (up to 15 seconds).</li>
              <li>Multiple attempts may be allowed; best score is considered.</li>
              <li>Early clicks (before signal) may result in penalty or retry.</li>
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">2. Memory Match Game (3x3 Grid)</h2>
            <ul>
              <li>Objective: Match all card pairs within 15 seconds.</li>
              <li>Grid Size: 3x3 grid (4 pairs + 1 dummy card).</li>
              <li>Time Limit: 15 seconds (15000 milliseconds).</li>
              <li>Lives: Maximum 3 incorrect attempts allowed.</li>
              <li>Each turn allows flipping 2 cards.</li>
              <li>If cards match, they remain open; if not, they flip back.</li>
              <li>Game ends when all pairs are matched OR lives are exhausted OR time runs out.</li>
              <li>Score is based on speed, number of correct matches, and remaining lives.</li>
              <li>Faster completion with fewer mistakes results in higher score.</li>
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">3. Focus Control / Ball Balance Game</h2>
            <ul>
              <li>Objective: Keep the ball inside the Revital zone.</li>
              <li>Total Game Duration: 15 seconds (15000 milliseconds).</li>
              <li>Score is based on the total time the ball remains inside the box.</li>
              <li>Maximum Score: 1500 points if ball stays inside for full duration.</li>
              <li>Minimum Score: 0 points if ball remains outside the box.</li>
              <li>Continuous control improves score; losing control reduces score.</li>
              <li>Smooth and stable control leads to higher performance.</li>
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
