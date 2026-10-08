import { describe, expect, it } from "vitest";
import { extractProductImage } from "../server/shopPreview.ts";
import { shopSearchUrl } from "../shared/shops.ts";

describe("shop preview pictures", () => {
  it("keeps an already translated query in the search URL", () => {
    expect(shopSearchUrl("taobao", "路飞 角色扮演 草帽")).toBe(
      "https://world.taobao.com/search/search.htm?q=%E8%B7%AF%E9%A3%9E+%E8%A7%92%E8%89%B2%E6%89%AE%E6%BC%94+%E8%8D%89%E5%B8%BD",
    );
    expect(shopSearchUrl("missing", "hat")).toBeNull();
  });

  it("picks a product photo and skips shop chrome", () => {
    expect(
      extractProductImage(
        "amazon",
        `<img src="https://m.media-amazon.com/images/I/414QZMeLYML._AC_SR250,250_QL65_.jpg">
         <img src="https://m.media-amazon.com/images/I/71HAT123._AC_UL320_.jpg">
         <img src="https://m.media-amazon.com/images/I/11sprite.css">`,
      ),
    ).toBe("https://m.media-amazon.com/images/I/71HAT123._AC_UL320_.jpg");

    expect(
      extractProductImage(
        "aliexpress",
        `https://ae-pic-a1.aliexpress-media.com/kf/Sicon/96x96.png ae-pic-a1.aliexpress-media.com/kf/Shat.jpg_480x480q75.jpg_.avif`,
      ),
    ).toBe("https://ae-pic-a1.aliexpress-media.com/kf/Shat.jpg_480x480q75.jpg_.avif");

    expect(extractProductImage("ebay", `https://i.ebayimg.com/images/g/abc/s-l140.jpg https://i.ebayimg.com/images/g/xyz/s-l500.jpg`)).toBe(
      "https://i.ebayimg.com/images/g/xyz/s-l500.jpg",
    );

    expect(extractProductImage("taobao", String.raw`https:\/\/img.alicdn.com\/imgextra\/i1\/hat.jpg`)).toBe(
      "https://img.alicdn.com/imgextra/i1/hat.jpg",
    );
    expect(
      extractProductImage(
        "taobao",
        "https://img.alicdn.com/imgextra/i4/O1CN018te29G1i9VptXFLMq_!!6000000004370-2-tps-96-96.png",
      ),
    ).toBeNull();
  });
});
