import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-4xl md:text-5xl font-black text-garnet">
          Revital Energy Challenge Campaign — Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: {new Date().toLocaleDateString()}
        </p>

        <div className="prose prose-sm md:prose-base mt-8 space-y-5 text-garnet/85">
          <section>
            <h2 className="text-xl font-bold text-garnet">1. Introduction</h2>
            <p>
              This Privacy Policy explains how personal information is collected, used, stored, and
              protected in connection with participation in the Revital Energy Challenge Campaign
              organized for the brand Revital.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">2. Information Collected</h2>
            <p>During campaign participation, the following information may be collected:</p>
            <ul>
              <li>Name</li>
              <li>Email address</li>
              <li>Phone number</li>
              <li>Country or location</li>
              <li>Gameplay data including scores and rankings</li>
              <li>Device and browser information</li>
              <li>IP address and technical identifiers</li>
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">3. Purpose of Data Collection</h2>
            <p>Participant data may be collected and processed for the following purposes:</p>
            <ul>
              <li>Managing campaign participation</li>
              <li>Generating gameplay scores and leaderboard rankings</li>
              <li>Contacting winners and distributing prizes</li>
              <li>Preventing fraud or misuse</li>
              <li>Improving user experience and campaign performance</li>
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">4. Data Sharing</h2>
            <p>
              Participant information may be shared with authorized campaign partners, technology
              providers, or agencies responsible for executing the campaign. Data will not be sold
              to unrelated third parties.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">5. Data Security</h2>
            <p>
              The Organizer implements reasonable administrative and technical safeguards designed
              to protect personal information from unauthorized access, misuse, or disclosure.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">6. Data Retention</h2>
            <p>
              Personal information will be retained only for the period necessary to manage the
              campaign, fulfill rewards, and comply with legal obligations.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">7. Participant Rights</h2>
            <p>
              Participants may request access to their personal information or request correction of
              inaccurate data where permitted by applicable laws.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">8. Cookies and Tracking Technologies</h2>
            <p>
              The campaign platform may use cookies or similar technologies to track participation
              metrics, enhance user experience, and measure campaign engagement.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">9. UAE Data Compliance</h2>
            <p>
              Personal data collected during this campaign shall be handled in accordance with
              applicable data protection regulations within the United Arab Emirates.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">10. Updates to Policy</h2>
            <p>
              The Organizer reserves the right to update this Privacy Policy at any time. Updated
              versions will be made available on the campaign platform.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">11. Contact Information</h2>
            <p>
              For questions regarding this Privacy Policy or the handling of personal data related
              to the campaign, participants may contact the campaign support team through the
              official campaign platform.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
