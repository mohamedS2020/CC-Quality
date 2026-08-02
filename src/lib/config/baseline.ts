import type { ConfigInput, ErrorReasonInput } from "./input";

/**
 * The verified baseline scorecard config (design doc Appendix B/D/H), seeded as
 * version 1 (FR-28). Ground truth for the CC/EUC/BC/NC rubric — all 79 error
 * reasons — plus rank weights (10/25/35/30), rank benchmarks, and the three
 * aggregation lenses with their per-section benchmarks.
 *
 * Dictionary entries (per-reason severity/definition/training bucket) are left
 * for the admin to complete via the config editor; only the starter severity and
 * training-bucket reference lists are seeded here.
 */

const r = (label: string): ErrorReasonInput => ({ label, dictionary: null });

export const baselineConfigInput: ConfigInput = {
  name: "CC MarQ Quality Scorecard",
  description: "Verified baseline (Appendix B/D) — version 1.",
  roundingDecimals: 2,
  paretoCutoff: 0.8,
  newAgentTenureDays: 90,
  trialWindowDays: 90,
  severities: ["Soft Skills", "Business Critical"],
  trainingBuckets: ["Telephone etiquette"],
  sections: [
    {
      code: "CC",
      label: "Critical Compliance",
      scoringMode: "SECTION_BINARY",
      critical: true,
      capPerAttribute: false,
      rankWeight: 10,
      rankBenchmark: 0.995,
      categories: [
        {
          label: "Confidentiality",
          attributes: [
            {
              label: "Security verification",
              errorReasons: [
                r("Didn't make security verification"),
                r("Released customer personal data"),
              ],
            },
          ],
        },
      ],
    },
    {
      code: "EUC",
      label: "End User Critical",
      scoringMode: "SECTION_BINARY",
      critical: true,
      capPerAttribute: false,
      rankWeight: 25,
      rankBenchmark: 0.98,
      categories: [
        {
          label: "Customer Need Fulfillment",
          attributes: [
            {
              label: "Escalating / directing the customer to the correct channels",
              errorReasons: [
                r("Didn't direct the customer to the appropriate channel"),
                r("Didn't escalate when required"),
                r("Didn't Fulfill (Handle) Customer's Inquiry/Request/Complaint"),
                r("Overpromising"),
                r("Didn't follow up with the customer on time / as promised"),
                r("Didn't follow up with the customer when required"),
                r("Didn't take the proper action on the system"),
              ],
            },
            {
              label: "Failing to describe information / service",
              errorReasons: [r("Described inaccurate, incomplete information / service")],
            },
            {
              label: "Security verification",
              errorReasons: [r("Verified the customer's data unnecessarily")],
            },
          ],
        },
        {
          label: "Professionalism",
          attributes: [
            {
              label: "Avoids or disconnects the call",
              errorReasons: [
                r("Close the call intentionally during the conversation"),
                r("Didn't follow the appropriate silent call procedure"),
                r("Released / Avoids the call"),
                r("Exceeding hold time, and the client ends the call"),
              ],
            },
            {
              label: "Uses of inappropriate and offensive behavior",
              errorReasons: [
                r("Aggressive with the customer"),
                r("Not friendly Behavior"),
                r("Improper negotiation"),
                r("Insulted / Shouted at the customer"),
                r("Showed understanding with an aggressive tone"),
                r("Took things personally"),
                r("Used rude comments or behavior"),
              ],
            },
          ],
        },
      ],
    },
    {
      code: "BC",
      label: "Business Critical",
      scoringMode: "SECTION_BINARY",
      critical: true,
      capPerAttribute: false,
      rankWeight: 35,
      rankBenchmark: 0.95,
      categories: [
        {
          label: "Company Image",
          attributes: [
            {
              label: "Displays positive company image",
              errorReasons: [
                r("Wrong company name in the closing"),
                r("Didn't maintain a positive Company image"),
                r("Wrong company name in the greeting"),
                r("Used company's applications name"),
              ],
            },
          ],
        },
        {
          label: "Reporting",
          attributes: [
            {
              label: "Creating call reason/Activity",
              errorReasons: [
                r("Didn't create Call Reason - System activities for all customer's inquiries"),
                r("Wrong call reason - System activity"),
              ],
            },
          ],
        },
        {
          label: "Data&System accuracy",
          attributes: [
            {
              label: "Didn't Correct data when required",
              errorReasons: [r("Didn't Correct data when required")],
            },
          ],
        },
        {
          label: "Business Requirement & process",
          attributes: [
            {
              label: "Script compliance",
              errorReasons: [r("Didn't describe Script - info")],
            },
          ],
        },
      ],
    },
    {
      code: "NC",
      label: "Non Critical",
      scoringMode: "GRADED_ATTRIBUTES",
      critical: false,
      capPerAttribute: false,
      rankWeight: 30,
      rankBenchmark: 0.95,
      categories: [
        {
          label: "Non Critical",
          attributes: [
            {
              label: "Controls the call well",
              errorReasons: [
                r("Didn't thank the customer for hold"),
                r("Didn't wait for customer permission"),
                r("Exceeding hold time"),
                r("Didn't use the hold statement"),
                r("Didn't give the reason for hold"),
                r("Used mute button"),
                r("Used language not match with the customer"),
                r("Didn't avoid dead air all the time"),
                r("Not concentrated - Active listing"),
                r("Interrupted the customer"),
                r("Didn't check Systems Data properly / On the spot"),
                r("Asking the customer for an information already mentioned before"),
                r("Didn't Collect the Data in a Smart Way - In-complete description"),
                r("Didn't keep the conversation on track"),
                r("Didn't manage time well"),
                r("Let the customer control the call"),
                r("Not patient"),
                r("Over confident"),
                r("Didn't absorb customer anger"),
              ],
            },
            {
              label: "Offers a sincere apology showing understanding & displaying empathy",
              errorReasons: [
                r("Didn't offer a sincere apology showing understanding of the situation"),
                r("Didn't allow customer to vent completely"),
                r("Not empathetic"),
                r("Not understanding / Showed understanding with over reacting"),
              ],
            },
            {
              label: "Professional personalization",
              errorReasons: [
                r("Used repetitive word"),
                r("Used language not matched with the customer"),
                r("Didn't avoid mouth noise"),
                r("Used unprofessional expression(s)"),
              ],
            },
            {
              label: "Uses appropriate Greeting/Closing",
              errorReasons: [
                r("Incomplete closing"),
                r("Incomplete greeting"),
                r("No closing at all"),
                r("No greeting at all"),
                r("Un Clear Closing"),
                r("Un Clear Greeting"),
                r("Inaccurate greeting time"),
                r("Wrong closing"),
                r("Late response"),
                r("Didn't ask for customer Name"),
                r("Welcoming the customer"),
                r("Didn't offer extra assistance"),
                r("Used jargon - slang language"),
              ],
            },
            {
              label: "Standard verification",
              errorReasons: [r("Verified the customer's data while no need for it")],
            },
            {
              label: "Voice Tone",
              errorReasons: [
                r("Monotony"),
                r("Not Keen - Not Willing - Not enthusiastic - Not caring"),
                r("Scripted - Robotic"),
                r("Sleepy - Not energetic tone"),
                r("Very fast"),
                r("Not clear"),
                r("Not confident and hesitant"),
                r("Sharp voice tone"),
              ],
            },
          ],
        },
      ],
    },
  ],
  lenses: [
    {
      key: "account",
      label: "Account",
      basis: "PER_ERROR",
      benchmarks: [
        { sectionCode: "CC", threshold: 0.995 },
        { sectionCode: "EUC", threshold: 0.98 },
        { sectionCode: "BC", threshold: 0.95 },
        { sectionCode: "NC", threshold: 0.95 },
      ],
    },
    {
      key: "program",
      label: "Program",
      basis: "PER_SCORESHEET",
      benchmarks: [
        { sectionCode: "CC", threshold: 0.995 },
        { sectionCode: "EUC", threshold: 0.95 },
        { sectionCode: "BC", threshold: 0.9 },
        { sectionCode: "NC", threshold: 0.95 },
      ],
    },
    {
      key: "agent",
      label: "Agent",
      basis: "FAILED_SCORESHEETS",
      benchmarks: [
        { sectionCode: "CC", threshold: 0.995 },
        { sectionCode: "EUC", threshold: 0.95 },
        { sectionCode: "BC", threshold: 0.9 },
        { sectionCode: "NC", threshold: 0.95 },
      ],
    },
  ],
};
