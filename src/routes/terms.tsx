import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-4xl md:text-5xl font-black text-garnet">
          Revital Energy Challenge Campaign — Terms &amp; Conditions
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: {new Date().toLocaleDateString()}
        </p>

        <div className="prose prose-sm md:prose-base mt-8 space-y-5 text-garnet/85">
          <section>
            <h2 className="text-xl font-bold text-garnet">1. Organizer</h2>
            <p>
              The Revital Energy Challenge Campaign (“Campaign”) is organized and managed by Revital
              Brand Team and its authorized marketing partners (collectively referred to as the
              “Organizer”). The campaign is conducted for promotional and engagement purposes for
              the brand Revital.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">2. Acceptance of Terms</h2>
            <p>
              By accessing or participating in the Campaign, participants agree to comply with these
              Terms &amp; Conditions and any applicable laws and regulations governing promotional
              campaigns.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">3. Eligibility</h2>
            <ul>
              <li>Participants must be eighteen (18) years of age or older.</li>
              <li>Participation is open only to residents of the United Arab Emirates (UAE).</li>
              <li>
                Participants must provide accurate and complete personal details when registering.
              </li>
              <li>
                Employees, partners, and agencies associated with the Campaign may be restricted
                from participation if required.
              </li>
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">4. Campaign Overview</h2>
            <p>
              The campaign is an interactive digital challenge where participants engage in short
              online games designed to test stamina, reflex, focus, and sustained concentration.
              Participants receive a performance-based score which may appear on the campaign
              leaderboard.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">5. Participation Rules</h2>
            <ul>
              <li>
                Participants may access the campaign through the official campaign platform or
                microsite.
              </li>
              <li>
                Each participant may attempt the challenges multiple times; however, only the best
                valid score may be considered for leaderboard rankings.
              </li>
              <li>
                The Organizer reserves the right to monitor gameplay activity to ensure fairness.
              </li>
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">6. Scoring and Leaderboard</h2>
            <p>
              Scores are generated based on gameplay performance including reaction time, speed,
              accuracy, and completion of challenges. Only the highest valid score during the
              defined period may be considered for leaderboard positioning. The Organizer reserves
              the right to review, verify, and adjust scores if irregularities are detected.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">7. Prizes and Winner Selection</h2>
            <p>
              Participants ranking at the top of the leaderboard may be eligible for campaign
              rewards. Winners may be required to provide valid identification and verification
              before prize fulfillment. Prizes must be claimed within seven (7) days from the
              announcement date unless otherwise specified.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">8. Tie-Breaker</h2>
            <p>
              In the event of identical scores among participants, the Organizer reserves the right
              to determine the final winner based on additional gameplay metrics or internal
              evaluation criteria.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">9. Disqualification</h2>
            <p>The Organizer reserves the right to disqualify any participant who:</p>
            <ul>
              <li>Provides false or misleading information</li>
              <li>Attempts to manipulate the scoring mechanism</li>
              <li>Uses automated systems, bots, or unfair practices</li>
              <li>Violates campaign guidelines or applicable laws</li>
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">10. Data Verification</h2>
            <p>
              Winners may be required to present a valid government-issued identification document
              for verification before receiving prizes.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">11. Limitation of Liability</h2>
            <p>
              The Organizer shall not be responsible for any technical malfunction, internet
              connectivity issues, device incompatibility, or system failure that may affect
              participation in the campaign.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">12. Modification or Termination</h2>
            <p>
              The Organizer reserves the right to modify, suspend, or terminate the campaign or its
              rules at any time due to technical, operational, or legal reasons without prior
              notice.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">13. UAE Legal Compliance</h2>
            <p>
              This campaign shall be governed by and interpreted in accordance with the applicable
              laws and regulations of the United Arab Emirates. Any disputes arising from
              participation in the campaign shall be subject to the exclusive jurisdiction of the
              competent courts within the UAE.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">14. Final Decision</h2>
            <p>
              All decisions made by the Organizer regarding the campaign, leaderboard rankings,
              prize allocation, and participation eligibility shall be final and binding.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
