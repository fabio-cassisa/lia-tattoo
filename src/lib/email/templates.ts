/**
 * Shared email styles and layout wrapper.
 * Matches the liagiorgi.one.ttt brand: sabbia palette, ink black, trad red.
 */

const BRAND = {
  sabbia: "#f5f0e8",
  ink: "#1a1a1a",
  tradRed: "#c41e3a",
  mutedText: "#6b6560",
  border: "#e0dbd3",
  white: "#ffffff",
} as const;

export function emailWrapper(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>liagiorgi.one.ttt</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND.sabbia}; font-family: Georgia, 'Times New Roman', serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${BRAND.sabbia};">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: ${BRAND.white}; border: 1px solid ${BRAND.border}; border-radius: 4px;">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid ${BRAND.border};">
              <h1 style="margin: 0; font-size: 20px; font-weight: normal; color: ${BRAND.ink}; letter-spacing: 0.05em;">
                liagiorgi.one.ttt
              </h1>
              <p style="margin: 4px 0 0; font-size: 11px; color: ${BRAND.mutedText}; letter-spacing: 0.15em; text-transform: uppercase;">
                &#10043; Traditional Tattoo Artist &#10043;
              </p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid ${BRAND.border}; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: ${BRAND.mutedText};">
                <a href="https://instagram.com/liagiorgi.one.ttt" style="color: ${BRAND.mutedText}; text-decoration: none;">@liagiorgi.one.ttt</a>
              </p>
              <p style="margin: 8px 0 0; font-size: 11px; color: ${BRAND.mutedText};">
                Malm&ouml; / Diamant studio &middot; Copenhagen / Good Morning Tattoo studio
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Style a primary CTA button */
export function ctaButton(text: string, href: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px auto;">
      <tr>
        <td style="background-color: ${BRAND.ink}; border-radius: 3px;">
          <a href="${href}" style="display: inline-block; padding: 12px 28px; color: ${BRAND.sabbia}; font-size: 14px; font-family: Georgia, 'Times New Roman', serif; text-decoration: none; letter-spacing: 0.05em;">
            ${text}
          </a>
        </td>
      </tr>
    </table>`;
}

/** Style for section headings inside emails */
export function sectionHeading(text: string): string {
  return `<h2 style="margin: 0 0 16px; font-size: 18px; font-weight: normal; color: ${BRAND.ink};">${text}</h2>`;
}

/** Style for a detail row (label: value) */
export function detailRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding: 6px 0; font-size: 13px; color: ${BRAND.mutedText}; vertical-align: top; width: 120px;">${label}</td>
      <td style="padding: 6px 0; font-size: 13px; color: ${BRAND.ink};">${value}</td>
    </tr>`;
}

/** Wrap detail rows in a table */
export function detailsTable(rows: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 16px 0;">
      ${rows}
    </table>`;
}

export { BRAND };
