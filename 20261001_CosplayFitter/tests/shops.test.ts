import { describe, expect, it } from "vitest";
import { shopItems, shopLinks, shopSearchQuery } from "../shared/shops.ts";

describe("shop search advice", () => {
  it("builds a cosplay query from the character and the preview garments", () => {
    expect(
      shopSearchQuery("Monkey D. Luffy", {
        name: "Straw-hat day cosplay",
        garments: ["straw hat", "open red vest", "blue shorts", "sandals"],
      }),
    ).toBe("Monkey D. Luffy cosplay straw hat open red vest blue shorts sandals");
  });

  it("falls back to the look name when no character is set", () => {
    expect(shopSearchQuery("  ", { name: "Ink suit", garments: ["oxfords"] })).toBe("Ink suit cosplay oxfords");
  });

  it("opens only Taobao, AliExpress, Amazon, and eBay", () => {
    const links = shopLinks("Luffy cosplay straw hat");
    expect(links.map((link) => link.name)).toEqual(["Taobao", "AliExpress", "Amazon", "eBay"]);
    expect(new URL(links[0]?.href ?? "").searchParams.get("q")).toBe("路飞 角色扮演 草帽");
    expect(new URL(links[1]?.href ?? "").searchParams.get("SearchText")).toBe("路飞 角色扮演 草帽");
    expect(links[2]?.href).toBe("https://www.amazon.com/s?k=Luffy+cosplay+straw+hat");
    expect(links[3]?.href).toBe("https://www.ebay.com/sch/i.html?_nkw=Luffy+cosplay+straw+hat");
  });

  it("gives each garment its own purchase links", () => {
    const items = shopItems("Monkey D. Luffy", {
      name: "Straw-hat day cosplay",
      garments: [" straw hat ", "", "open red vest"],
    });
    expect(items.map((item) => item.garment)).toEqual(["straw hat", "open red vest"]);
    expect(items[0]?.query).toBe("Monkey D. Luffy cosplay straw hat");
    expect(items[0]?.links[0]?.query).toBe("路飞 角色扮演 草帽");
    expect(new URL(items[0]?.links[0]?.href ?? "").searchParams.get("q")).toBe("路飞 角色扮演 草帽");
    expect(items[1]?.links[1]?.query).toBe("路飞 角色扮演 红色开襟背心");
    expect(items[1]?.links[2]?.href).toBe("https://www.amazon.com/s?k=Monkey+D.+Luffy+cosplay+open+red+vest");
    expect(items[1]?.links[3]?.query).toBe("Monkey D. Luffy cosplay open red vest");
    expect(items[0]?.links.map((link) => link.name)).toEqual(["Taobao", "AliExpress", "Amazon", "eBay"]);
  });
});
