import { formatTokens, formatUsd } from "@shared/estimate.ts";
import type { ActualUsage, TokenEstimate } from "@shared/types.ts";

interface TokenReceiptProps {
  estimate: TokenEstimate | null;
  refineState: "local" | "loading" | "refined" | "failed";
  pendingReason: string | null;
  actual: ActualUsage | null;
}

export function TokenReceipt({ estimate, refineState, pendingReason, actual }: TokenReceiptProps) {
  return (
    <section className="receipt" aria-live="polite" data-testid="receipt">
      <header className="receipt-head">
        <h2>Estimated tokens</h2>
        <p>
          {refineState === "loading"
            ? "Asking Gemini to count the input text…"
            : refineState === "refined"
              ? "Gemini counted the photo and the input text. Output images still use the published 1K and 2K table."
              : refineState === "failed"
                ? "Gemini could not recount the input. Image tokens still use the published table."
                : "Text is estimated at about 4 characters per token. Image tokens use the published table."}
        </p>
      </header>
      {estimate ? (
        <>
          <dl className="receipt-lines">
            {estimate.lines.map((line) => (
              <div key={line.label}>
                <dt>{line.label}</dt>
                <dd>
                  <span>{formatTokens(line.tokens)}</span>
                  <small>{line.note}</small>
                </dd>
              </div>
            ))}
          </dl>
          <div className="receipt-total">
            <span>Total before generate</span>
            <strong data-testid="token-total" data-tokens={estimate.totalTokens}>
              {formatTokens(estimate.totalTokens)}
            </strong>
            <em data-testid="token-usd">{formatUsd(estimate.usd)}</em>
          </div>
        </>
      ) : (
        <p className="receipt-pending" data-testid="receipt-pending">
          {pendingReason}
        </p>
      )}
      {actual ? (
        <div className="receipt-actual" data-testid="token-actual">
          <span>Actual this run</span>
          <strong>
            {formatTokens(actual.totalTokens)} tokens
          </strong>
          <small>
            {formatTokens(actual.inputTokens)} in · {formatTokens(actual.outputTokens)} out
          </small>
        </div>
      ) : null}
    </section>
  );
}
