import { useMemo } from "react";
import { useStore, findRefs } from "./store";
import {
  analyzeLeg,
  buildNotHome,
  buildPairingHints,
  buildRanking,
  buildTimeline,
  resolveReviews,
  type LegAnalysis,
} from "../domain/model";
import type { PersistState } from "../domain/types";

export interface Derived {
  analyses: LegAnalysis[];
  analysisById: Map<string, LegAnalysis>;
  ranking: ReturnType<typeof buildRanking>;
  notHome: ReturnType<typeof buildNotHome>;
  pairing: ReturnType<typeof buildPairingHints>;
  timeline: ReturnType<typeof buildTimeline>;
  reviewerIds: string[];
}

function derive(state: PersistState): Derived {
  const { ringById, siteById, clockById } = findRefs(state);
  const analyses = state.legs.map((leg) =>
    analyzeLeg({
      leg,
      ring: ringById.get(leg.ringId),
      site: siteById.get(leg.siteId),
      clock: clockById.get(leg.clockId),
      maxMpm: state.maxMpm,
      toleranceKm: state.toleranceKm,
    })
  );
  const reviewerIds = state.reviewers.map((r) => r.id);
  const ranking = buildRanking(analyses, state.reviews, reviewerIds);
  const notHome = buildNotHome(analyses, state.reviews, reviewerIds);
  const pairing = buildPairingHints(state.rings, ranking);
  const timeline = buildTimeline(analyses, state.reviews);
  return {
    analyses,
    analysisById: new Map(analyses.map((a) => [a.leg.id, a])),
    ranking,
    notHome,
    pairing,
    timeline,
    reviewerIds,
  };
}

export function useDerived(stateArg?: PersistState): Derived {
  const store = useStore();
  const state = stateArg ?? store.state;
  return useMemo(() => derive(state), [state]);
}

export { resolveReviews };
