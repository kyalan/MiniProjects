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
            ? "Asking Gemini to count the input…"
            : refineState === "refined"
              ? "Gemini counted the input, and that count is not raised. Output images use 1,120 tokens at 1K and 1,680 at 2K."
              : refineState === "failed"
                ? "Gemini could not recount the input. Output images still use 1,120 tokens at 1K and 1,680 at 2K."
                : "Text is about 4 characters per token. Output images use 1,120 tokens at 1K and 1,680 at 2K. Input images use 1,120 until Gemini counts them, and that count is never raised."}
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
