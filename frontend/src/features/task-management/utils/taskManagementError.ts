type TaskManagementErrorInfo = {
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
      return `You do not have permission to ${operation}. This usually happens when the current user role is not allowed to manage or review project tasks.`;
    }
  
    if (text.includes("401") || text.includes("unauthorized")) {
      return `Your session may be expired or you are not authenticated. Sign in again and retry the action.`;
    }
  
    if (text.includes("404") || text.includes("not found")) {
      return `The required assignment, task, developer, or project record was not found. It may have been removed or not created yet.`;
    }
  
    if (text.includes("500") || text.includes("internal server error")) {
      return `The backend failed while processing the task-management request. This is usually caused by invalid assignment state, missing related data, or a server-side exception.`;
    }
  
    if (text.includes("network") || text.includes("failed to fetch")) {
      return `The frontend could not reach the backend. Django may not be running, the API URL may be wrong, or there may be a connection problem.`;
    }
  
    if (text.includes("assignment")) {
      return `The task assignment could not be loaded or updated. The assignment may not exist, or the backend may have rejected the requested state change.`;
    }
  
    if (text.includes("developer")) {
      return `The selected developer may not be a valid member of the project, or the backend rejected the assignment.`;
    }
  
    if (text.includes("evaluation") || text.includes("score")) {
      return `The evaluation could not be saved. One or more scores may be invalid, or the task may not be in a reviewable state yet.`;
    }
  
    if (text.includes("submitted") || text.includes("review")) {
      return `The task review action could not be completed. The task may not be in the correct status for accept/reject review.`;
    }
  
    if (text.includes("task")) {
      return `Task management data could not be loaded or updated. This usually happens when extracted BPMN tasks, project members, or assignment records are missing.`;
    }
  
    return `The task-management action failed because the backend returned an error or rejected the request. Check the technical details below for the exact reason.`;
  }
  
  export function buildTaskManagementError(
    operation: string,
    error: unknown,
    fallbackTitle?: string
  ): TaskManagementErrorInfo {
    const raw = normalizeMessage(error);
  
    return {
      title: fallbackTitle || `${operation} failed`,
      message: `The action "${operation}" could not be completed.`,
      cause: detectCause(operation, raw),
      details: raw,
    };
  }