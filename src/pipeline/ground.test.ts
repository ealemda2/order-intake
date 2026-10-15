import { describe, expect, it } from "vitest";
import { emptyFields, type ExtractedFields } from "../contract";
import { ground } from "./ground";

const DOC = `Re: Patient Name (Last, First): Kaya, Yusuf
Date of Birth: 01/27/1990    Member #: CIG-8890211
Ordering provider: Selin Aydin, MD     NPI: 1928374655
Order date: 2026-03-08`;

const withField = (patch: Partial<ExtractedFields>): ExtractedFields => ({ ...emptyFields(), ...patch });
const codes = (fields: ExtractedFields) => Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, f.flags.map((x) => x.code)]));

describe("ground", () => {
  it("flags a field whose source quote is not in the document", () => {
    const fields = withField({ providerNpi: { value: "1928374656", sourceQuote: "NPI: 1928374656", flags: [] } });

    expect(ground(DOC, fields).providerNpi.flags.map((f) => f.code)).toEqual(["ungrounded"]);
  });

  it("accepts a quote that differs from the document only in case and whitespace", () => {
    const fields = withField({ providerNpi: { value: "1928374655", sourceQuote: "npi:   1928374655", flags: [] } });

    expect(codes(ground(DOC, fields)).providerNpi).toEqual([]);
  });

  it("flags a value that has no source quote, but not an abstained field", () => {
    const fields = withField({ memberId: { value: "CIG-8890211", sourceQuote: null, flags: [] } });

    const result = codes(ground(DOC, fields));
    expect(result.memberId).toEqual(["ungrounded"]);
    expect(result.patientDob).toEqual([]);
  });

  describe("value supported by its own quote", () => {
    it("matches codes ignoring spaces and hyphens", () => {
      const fields = withField({
        memberId: { value: "CIG 8890211", sourceQuote: "Member #: CIG-8890211", flags: [] },
        providerNpi: { value: "1928374699", sourceQuote: "NPI: 1928374655", flags: [] },
      });

      const result = codes(ground(DOC, fields));
      expect(result.memberId).toEqual([]);
      expect(result.providerNpi).toEqual(["ungrounded"]);
    });

    it("matches dates after normalising both sides to ISO", () => {
      const fields = withField({
        patientDob: { value: "1990-01-27", sourceQuote: "01/27/1990", flags: [] },
        orderDate: { value: "2026-03-08", sourceQuote: "Order date: 2026-03-08", flags: [] },
      });
      const dayMonthSwapped = withField({ patientDob: { value: "1990-27-01", sourceQuote: "01/27/1990", flags: [] } });
      const offByOne = withField({ orderDate: { value: "2026-03-09", sourceQuote: "2026-03-08", flags: [] } });

      expect(codes(ground(DOC, fields))).toMatchObject({ patientDob: [], orderDate: [] });
      expect(codes(ground(DOC, dayMonthSwapped)).patientDob).toEqual(["ungrounded"]);
      expect(codes(ground(DOC, offByOne)).orderDate).toEqual(["ungrounded"]);
    });

    it("matches names token by token, so a Last, First quote supports a First Last value", () => {
      const fields = withField({
        patientName: { value: "Yusuf Kaya", sourceQuote: "Kaya, Yusuf", flags: [] },
        providerName: { value: "Selin Aydin", sourceQuote: "Selin Aydin, MD", flags: [] },
      });
      const misspelt = withField({ patientName: { value: "Yusuf Kayan", sourceQuote: "Kaya, Yusuf", flags: [] } });

      expect(codes(ground(DOC, fields))).toMatchObject({ patientName: [], providerName: [] });
      expect(codes(ground(DOC, misspelt)).patientName).toEqual(["ungrounded"]);
    });
  });

  describe("never looser than the scorer", () => {
    const flagged = (patch: Partial<ExtractedFields>) => {
      const [key] = Object.keys(patch) as (keyof ExtractedFields)[];
      return codes(ground(DOC, withField(patch)))[key!];
    };
    const f = (value: string, sourceQuote: string) => ({ value, sourceQuote, flags: [] });

    it("flags a code that is only part of the identifier in its quote", () => {
      expect(flagged({ providerNpi: f("192837465", "NPI: 1928374655") })).toEqual(["ungrounded"]);
      expect(flagged({ memberId: f("8890211", "Member #: CIG-8890211") })).toEqual(["ungrounded"]);
    });

    it("keeps hyphens significant in ICD-10 codes", () => {
      const doc = "Diagnosis: Z00.00";
      expect(codes(ground(doc, withField({ icd10: f("Z-00.00", "Z00.00") }))).icd10).toEqual(["ungrounded"]);
      expect(codes(ground(doc, withField({ icd10: f("Z00.00", "Z00.00") }))).icd10).toEqual([]);
    });

    it("flags a date value that is not ISO YYYY-MM-DD", () => {
      expect(flagged({ patientDob: f("01-27-1990", "01/27/1990") })).toEqual(["ungrounded"]);
      expect(flagged({ patientDob: f("1990-1-27", "01/27/1990") })).toEqual(["ungrounded"]);
    });

    it("flags a date whose quote holds more than one date", () => {
      const doc = "Date of Birth: 01/27/1990  Order date: 2026-03-08";
      const swapped = withField({ patientDob: f("2026-03-08", "Date of Birth: 01/27/1990  Order date: 2026-03-08") });
      expect(codes(ground(doc, swapped)).patientDob).toEqual(["ungrounded"]);
    });

    it("flags a name with missing or reordered tokens", () => {
      expect(flagged({ patientName: f("Yusuf", "Kaya, Yusuf") })).toEqual(["ungrounded"]);
      expect(flagged({ providerName: f("Aydin Selin", "Selin Aydin, MD") })).toEqual(["ungrounded"]);
    });

    it("treats an empty source quote as no quote", () => {
      expect(flagged({ memberId: f("-", "") })).toEqual(["ungrounded"]);
    });
  });

  it("flags, never mutates: values and quotes come back exactly as given", () => {
    const input = withField({ patientDob: { value: "1990-01-28", sourceQuote: "01/27/1990", flags: [] } });

    const result = ground(DOC, input);
    expect(result.patientDob).toMatchObject({ value: "1990-01-28", sourceQuote: "01/27/1990" });
    expect(input.patientDob.flags).toEqual([]);
  });
});
