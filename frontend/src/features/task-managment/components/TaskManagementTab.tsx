import React, { useEffect, useState } from "react";
import TaskAssignmentRow from "./TaskAssignmentRow";
import {
  getProjectDevelopers,
  getProjectTaskAssignments,
} from "../api/taskManagementApi";
import type { Developer, TaskAssignmentItem } from "../types";

type Props = {
  projectId: number;
};

export default function TaskManagementTab({ projectId }: Props) {
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [taskAssignments, setTaskAssignments] = useState<TaskAssignmentItem[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadTaskAssignmentsOnly() {
    const taskData = await getProjectTaskAssignments(projectId);
    setTaskAssignments(taskData.items || []);
  }

  async function loadAll() {
    setLoading(true);
    setError("");

    try {
      const [devData, taskData] = await Promise.all([
        getProjectDevelopers(projectId),
        getProjectTaskAssignments(projectId),
      ]);

      setDevelopers(devData.developers || []);
      setTaskAssignments(taskData.items || []);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (projectId) {
      loadAll();
    }
  }, [projectId]);

  if (loading) {
    return <div>Loading task management...</div>;
  }

  if (error) {
    return <div style={{ color: "crimson" }}>{error}</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>Task Management</h3>
        <div style={{ color: "#666", marginTop: 6 }}>
          Assign extracted BPMN tasks to project developers and review submitted
          work.
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #ddd" }}>
              <th style={{ textAlign: "left", padding: 10 }}>Task ID</th>
              <th style={{ textAlign: "left", padding: 10 }}>Task Name</th>
              <th style={{ textAlign: "left", padding: 10 }}>
                Assigned Developer
              </th>
              <th style={{ textAlign: "left", padding: 10 }}>Status</th>
              <th style={{ textAlign: "left", padding: 10 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {taskAssignments.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 12, color: "#777" }}>
                  No extracted tasks found for this project.
                </td>
              </tr>
            ) : (
              taskAssignments.map((item) => (
                <TaskAssignmentRow
                  key={item.task.id}
                  projectId={projectId}
                  task={item.task}
                  assignment={item.assignment}
                  developers={developers}
                  onChanged={loadTaskAssignmentsOnly}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}