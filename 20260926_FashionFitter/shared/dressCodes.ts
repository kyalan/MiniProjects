export const DRESS_CODE_IDS = [
  "weekday_business_formal",
  "business_casual",
  "friday_smart_casual",
  "weekend_casual",
  "cocktail_evening",
  "creative_workplace",
] as const;

export type DressCodeId = (typeof DRESS_CODE_IDS)[number];

export interface DressCode {
  id: DressCodeId;
  label: string;
  summary: string;
  inBounds: string;
  outOfBounds: string;
}

export const DRESS_CODES: readonly DressCode[] = [
  {
    id: "weekday_business_formal",
    label: "Weekday business formal",
    summary: "Suiting and closed-toe shoes. No denim, sneakers, or loud prints.",
    inBounds:
      "Tailored suiting, sheath or shirt dresses, closed-toe leather shoes, and restrained color.",
    outOfBounds: "Denim, sneakers, loud prints, and open-toe shoes.",
  },
  {
    id: "business_casual",
    label: "Business casual",
    summary: "Chinos, knits, and loafers. No gym clothes or beach shorts.",
    inBounds:
      "Chinos or tailored trousers, blouses, knit polos, loafers, and simple dresses.",
    outOfBounds: "Gym wear, beach shorts, distressed denim, and flip-flops.",
  },
  {
    id: "friday_smart_casual",
    label: "Friday smart casual",
    summary: "Dark denim and an easy blazer. No slogan hoodies or athletic shorts.",
    inBounds:
      "Dark denim, unstructured blazers, neat knitwear, and clean leather sneakers or loafers.",
    outOfBounds: "Board shorts, slogan hoodies, athletic shorts, and beach sandals.",
  },
  {
    id: "weekend_casual",
    label: "Weekend casual",
    summary: "Jeans and clean layers. No office suiting or beachwear.",
    inBounds: "Jeans, clean t-shirts, overshirts, simple dresses, and comfortable sneakers.",
    outOfBounds: "Office suiting, beachwear, and ripped or slogan-heavy clothes.",
  },
  {
    id: "cocktail_evening",
    label: "Cocktail evening",
    summary: "A cocktail dress or dark suit. No office basics or sneakers.",
    inBounds: "Cocktail dresses or a dark suit, refined shoes, and one dressy accessory.",
    outOfBounds: "Office basics, shorts, sneakers, and costume themes.",
  },
  {
    id: "creative_workplace",
    label: "Creative workplace",
    summary: "Considered color and interesting tailoring. No loungewear or beachwear.",
    inBounds:
      "Considered color, interesting tailoring, polished boots or clean sneakers, and intentional personal pieces.",
    outOfBounds: "Sloppy loungewear, beachwear, and offensive graphics.",
  },
];

export function getDressCode(id: string): DressCode | undefined {
  return DRESS_CODES.find((code) => code.id === id);
}
