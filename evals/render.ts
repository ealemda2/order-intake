/** Renders a GoldenCase into the text layer of a synthetic inbound document. HUMAN-OWNED. */
import type { GoldenCase } from "./cases";

const CREDENTIALS: Record<string, string> = {
  "Selin Aydin": "MD",
  "Tomas Lindqvist": "NP",
  "Hannah Weiss": "MD",
  "Daniel Okafor": "DO",
  "Priya Raman": "MD",
};

const TITLES = {
  lab: "LABORATORY ORDER",
  imaging: "IMAGING ORDER",
  dme: "DME ORDER / DETAILED WRITTEN ORDER",
  referral: "REFERRAL",
  not_order: "",
} as const;

/** ISO -> MM/DD/YYYY */
function us(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

function minusDays(iso: string, days: number): string {
  const t = new Date(`${iso}T12:00:00Z`).getTime() - days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

function faxHeader(c: GoldenCase, from: string): string {
  return c.faxReceived ? `FAX  ${c.faxReceived}  FROM: ${from}  TO: CENTRAL INTAKE  P.01/01\n\n` : "";
}

function provider(c: GoldenCase): string {
  return `${c.providerName}, ${CREDENTIALS[c.providerName ?? ""] ?? "MD"}`;
}

function bosphorus(c: GoldenCase): string {
  const dob = c.patientDob ? us(c.patientDob) : "____________";
  const insurance = c.memberId
    ? `Insurance: on file          Member ID: ${c.memberId}`
    : "Insurance: Self-pay";
  const ordered =
    c.orderType === "referral"
      ? `Referral: ${c.orderText}`
      : `Ordered:\n  ${c.orderCode}  ${c.orderText}`;
  return `${faxHeader(c, "5550104411")}BOSPHORUS FAMILY MEDICINE
1450 Harbor View Rd, Suite 200  |  Tel (555) 010-4410  |  Fax (555) 010-4411

${TITLES[c.orderType]}                                   Priority: Routine

Patient: ${c.patientName}
DOB: ${dob}          Last office visit: ${us(minusDays(c.orderDate!, 15))}
${insurance}

Ordering provider: ${provider(c)}     NPI: ${c.providerNpi}

${ordered}
Diagnosis: ${c.icd10}  ${c.icd10Text}

Date of order: ${us(c.orderDate!)}
Signature: ${provider(c)} (electronically signed)
`;
}

function riverbend(c: GoldenCase): string {
  const [first, ...rest] = (c.patientName ?? "").split(" ");
  const lastFirst = `${rest.join(" ")}, ${first}`;
  const dob = c.patientDob ? us(c.patientDob) : "";
  const requested =
    c.orderType === "referral" ? c.orderText : `${c.orderText} (${c.orderCode})`;
  return `${faxHeader(c, "5550182200")}Riverbend Orthopedic & Spine
${TITLES[c.orderType]} - please fax to Central Intake, (555) 018-2200

Re: Patient Name (Last, First): ${lastFirst}
Date of Birth: ${dob}    Member #: ${c.memberId ?? "none on file"}

Requested: ${requested}
Reason / ICD-10: ${c.icd10} ${c.icd10Text}
Requested by: ${provider(c)}  |  NPI ${c.providerNpi}

Order date: ${c.orderDate}
`;
}

function northgate(c: GoldenCase): string {
  const pad = (s: string, n: number) => s.padEnd(n).slice(0, n);
  const dob = c.patientDob ? us(c.patientDob) : "";
  const order = c.orderCode ? `${c.orderCode} ${c.orderText}` : c.orderText;
  return `${faxHeader(c, "5550137700")}NORTHGATE PULMONARY ASSOCIATES            ${TITLES[c.orderType]}
-----------------------------------------------------------------------
| PATIENT     | ${pad(c.patientName ?? "", 26)} | DOB     | ${pad(dob, 10)} |
| MEMBER ID   | ${pad(c.memberId ?? "SELF-PAY", 26)} | SEX     | ${pad("", 10)} |
| PROVIDER    | ${pad(provider(c), 26)} | NPI     | ${pad(c.providerNpi ?? "", 10)} |
| ORDER       | ${order}
| DX (ICD-10) | ${c.icd10} ${c.icd10Text}
| DATE        | ${pad(us(c.orderDate!), 26)} | URGENCY | Routine    |
-----------------------------------------------------------------------
`;
}

function faxCover(c: GoldenCase): string {
  return `${faxHeader(c, "5550191234")}FAX COVER SHEET

To: Central Intake            From: Medical Records, Lakeside Clinic
Date: 03/15/2026              Pages (including cover): 3

Re: Records request for Leyla Demir (DOB 06/02/1958)

Please send the most recent office notes and imaging reports for the
patient above. Requested by Dr. Anika Brooks, NPI on request.

CONFIDENTIALITY NOTICE: This fax may contain protected health information.
`;
}

function fluReminder(): string {
  return `Bosphorus Family Medicine - Patient Newsletter, March 2026

Seasonal flu clinic: walk-in Saturdays 9:00-13:00 through 04/30/2026.
No appointment needed. Bring your insurance card.

Questions? Call (555) 010-4410.
`;
}

export function renderCase(c: GoldenCase): string {
  switch (c.template) {
    case "bosphorus":
      return bosphorus(c);
    case "riverbend":
      return riverbend(c);
    case "northgate":
      return northgate(c);
    case "fax-cover":
      return faxCover(c);
    case "flu-reminder":
      return fluReminder();
  }
}
