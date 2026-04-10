type ProjectErrorInfo = {
    title: string;
    message: string;
    cause: string;
    details: string;
  };
  
  function normalizeMessage(error: unknown): string {
    if (error instanceof Error) return error.message || "Unknown error";
    return String(error || "Unknown error");
  }
  
  function detectCause(operation: string, raw: string): string {
    const text = raw.toLowerCase();
  
    if (text.includes("403") || text.includes("forbidden")) {
      return `You do not have permission to ${operation}. This usually happens when the current user role is not allowed to perform this action for the project.`;
    }
  
    if (text.includes("401") || text.includes("unauthorized")) {
      return `Your session may be expired or you are not authenticated. Sign in again and retry the action.`;
    }
  
    if (text.includes("404") || text.includes("not found")) {
      return `The required project resource was not found. The project, file, endpoint, or related backend object may be missing.`;
    }
  
    if (text.includes("500") || text.includes("internal server error")) {
      return `The backend failed while processing the request. This is usually caused by a server-side exception, missing data, or invalid processing logic.`;
    }
  
    if (text.includes("network") || text.includes("failed to fetch")) {
      return `The frontend could not reach the backend. Django may not be running, the API URL may be wrong, or there may be a connection problem.`;
    }
  
    if (text.includes("bpmn")) {
      return `The BPMN file may be invalid, malformed, missing required elements, or not accepted by the backend parsing pipeline.`;
    }
  
    if (text.includes("zip") || text.includes("code")) {
      return `The uploaded code archive may be invalid, empty, unsupported, or the backend may have failed while extracting or indexing it.`;
    }
  
    if (text.includes("threshold")) {
      return `The similarity threshold value may be invalid or outside the expected numeric range.`;
    }
  
    if (text.includes("report")) {
      return `The report could not be generated or loaded. This usually means analysis data is missing, incomplete, or the backend report endpoint failed.`;
    }
  
    if (text.includes("recommend")) {
      return `Recommendations could not be loaded or generated. This usually happens when the BPMN summary is missing or the recommendation pipeline failed.`;
    }
  
    if (text.includes("compare")) {
      return `Compare inputs could not be prepared. BPMN task summaries or indexed code summaries may be missing, stale, or failed to load from the backend.`;
    }
  
    if (text.includes("analysis")) {
      return `Analysis failed while parsing BPMN, indexing code, generating summaries, embeddings, or matching results.`;
    }
  
    if (text.includes("task")) {
      return `Task management data could not be loaded or updated. The backend may be missing extracted BPMN tasks, project members, or assignment records.`;
    }
  
    return `The action failed because the backend returned an error or rejected the request. Check the technical details below to identify the exact reason.`;
  }
  
  export function buildProjectError(
    operation: string,
    error: unknown,
    fallbackTitle?: string
  ): ProjectErrorInfo {
    const raw = normalizeMessage(error);
  
    return {
      title: fallbackTitle || `${operation} failed`,
      message: `The action "${operation}" could not be completed.`,
      cause: detectCause(operation, raw),
      details: raw,
    };
  }
  
  export function buildProjectErrorFromText(
    operation: string,
    rawText: string,
    fallbackTitle?: string
  ): ProjectErrorInfo {
    return buildProjectError(operation, new Error(rawText), fallbackTitle);
  }