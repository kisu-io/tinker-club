// Offline stand-in for fonts.googleapis.com so `next build` in CI never depends on the network.
// Consumed by next/font via NEXT_FONT_GOOGLE_MOCKED_RESPONSES; keys must match src/app/layout.tsx.
const face = (family, style, weight) => `/* latin */
@font-face {
  font-family: '${family}';
  font-style: ${style};
  font-weight: ${weight};
  font-display: swap;
  src: url(https://fonts.gstatic.com/mock/${family.replace(/ /g, "")}-${style}-${weight}.woff2) format('woff2');
  unicode-range: U+0000-00FF;
}
`;

const faces = (family, styles, weights) =>
  styles.flatMap((style) => weights.map((weight) => face(family, style, weight))).join("");

module.exports = {
  "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap": faces(
    "Inter",
    ["normal"],
    [300, 400, 500, 600, 700],
  ),
  "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&display=swap":
    faces("Playfair Display", ["normal", "italic"], [400, 500, 600, 700]),
};
