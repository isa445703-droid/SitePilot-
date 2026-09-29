/**
 * Confirmation email body (React Email).
 *
 * Deliberately hook-free plain HTML with inline styles: email clients execute
 * no JavaScript and load no stylesheets, so the only CTA that can work is a
 * real anchor. Interactive behaviour lives on the landing page
 * (`/auth/confirm/email`), not here.
 */
export function VerificationEmail({
  title,
  description,
  cta,
  expires,
  url,
}: {
  title: string;
  description: string;
  cta: string;
  expires: string;
  url: string;
}) {
  return (
    <div
      style={{
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
        backgroundColor: "#f6f7f9",
        padding: "32px 16px",
      }}
    >
      <div
        style={{
          maxWidth: "480px",
          margin: "0 auto",
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          border: "1px solid #e5e7eb",
          padding: "32px 28px",
        }}
      >
        <div
          style={{
            display: "grid",
            placeItems: "center",
            width: "48px",
            height: "48px",
            borderRadius: "12px",
            backgroundColor: "#2563eb",
            color: "#ffffff",
            fontWeight: 800,
            marginBottom: "20px",
          }}
        >
          SP
        </div>

        <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#111827", margin: "0 0 12px" }}>
          {title}
        </h1>
        <p style={{ fontSize: "15px", lineHeight: 1.6, color: "#4b5563", margin: "0 0 24px" }}>
          {description}
        </p>

        <p style={{ margin: "0 0 24px" }}>
          <a
            href={url}
            style={{
              display: "inline-block",
              backgroundColor: "#2563eb",
              color: "#ffffff",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "15px",
              padding: "12px 22px",
              borderRadius: "12px",
            }}
          >
            {cta}
          </a>
        </p>

        <p style={{ fontSize: "13px", color: "#6b7280", margin: 0 }}>{expires}</p>
      </div>
    </div>
  );
}
