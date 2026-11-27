import { InvalidLink } from "@/components/invalid-link";
import { FALLBACK_VERTICAL } from "@/lib/verticals";

export default function NotFound() {
  return <InvalidLink brand={FALLBACK_VERTICAL} reason="invalid" />;
}
