/** Serializable rubric passed from the server page to the client form. */
export interface ScoreSheetRubric {
  sections: ScoreSheetSection[];
}

export interface ScoreSheetSection {
  id: number;
  code: string;
  label: string;
  categories: {
    id: number;
    label: string;
    attributes: {
      id: number;
      label: string;
      errorReasons: { id: number; label: string }[];
    }[];
  }[];
}

export interface ScoreSheetAgent {
  loginId: number;
  agentName: string;
}

/** The score sheet an evaluator submits — enter-only metadata (Appendix E.2)
 *  plus the flagged error reasons. Derived figures are NEVER part of this. */
export interface EvaluationDraft {
  agentLoginId: number;
  qaOwner: string;
  callDate: string; // yyyy-mm-dd
  callStart?: string;
  callEnd?: string;
  durationSeconds?: number;
  mobile?: string;
  callId?: string;
  queue?: string;
  transactionType?: string;
  monitoringType?: string;
  callType?: string;
  coachingDate?: string;
  flaggedReasonIds: number[];
}
