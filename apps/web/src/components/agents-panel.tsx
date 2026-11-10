"use client";

import { ArrowRight, Bot, Check, CircleAlert, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { agentRegistry, specialistAgents } from "@/lib/agents/registry";

type AgentMessage = {
  id: string;
  sender_role: "prime" | "specialist";
  sender_agent_id: string | null;
  content: string;
  created_at: string;
};

type AgentTask = {
  id: string;
  agent_id: string;
  agent: string;
  title: string;
  prompt: string;
  result: string | null;
  status: "running" | "awaiting_approval" | "approved" | "rejected" | "failed";
  created_at: string;
  messages: AgentMessage[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readError(value: unknown, fallback: string) {
  return isRecord(value) && typeof value.error === "string" ? value.error : fallback;
}

function isTask(value: unknown): value is AgentTask {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.agent_id === "string" &&
    typeof value.agent === "string" &&
    typeof value.title === "string" &&
    typeof value.prompt === "string" &&
    (typeof value.result === "string" || value.result === null) &&
    typeof value.status === "string" &&
    typeof value.created_at === "string" &&
    Array.isArray(value.messages)
  );
}

const statusLabels: Record<AgentTask["status"], string> = {
  running: "Working",
  awaiting_approval: "Needs your review",
  approved: "Recommendation approved",
  rejected: "Recommendation declined",
  failed: "Could not complete",
};

export function AgentsPanel({
  databaseConnected,
  aiConfigured,
}: {
  databaseConnected: boolean;
  aiConfigured: boolean;
}) {
  const [selectedAgent, setSelectedAgent] = useState<string>(specialistAgents[0].id);
  const [prompt, setPrompt] = useState("");
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewingTask, setReviewingTask] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let active = true;
    async function loadTasks() {
      try {
        if (!databaseConnected) return;
        const response = await fetch("/api/agents/tasks", { cache: "no-store" });
        const result: unknown = await response.json();
        if (!response.ok || !isRecord(result) || !Array.isArray(result.tasks)) {
          throw new Error(readError(result, "Agent tasks could not be loaded."));
        }
        if (active) setTasks(result.tasks.filter(isTask));
      } catch (error) {
        if (active) setStatus(error instanceof Error ? error.message : "Agent tasks could not be loaded.");
      } finally {
        if (active) setIsReady(true);
      }
    }
    void loadTasks();
    return () => { active = false; };
  }, [databaseConnected]);

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/agents/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: selectedAgent, prompt: prompt.trim() }),
      });
      const result: unknown = await response.json();
      const task = isRecord(result) ? result.task : undefined;
      if (!response.ok || !isTask(task)) {
        throw new Error(readError(result, "The agent task could not be completed."));
      }
      setTasks((current) => [task, ...current]);
      setPrompt("");
      setStatus("The specialist recommendation is ready for your review.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The agent task could not be completed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function decideTask(task: AgentTask, decision: "approved" | "rejected") {
    const action = decision === "approved" ? "approve this recommendation" : "decline this recommendation";
    if (!window.confirm(`Do you want to ${action}? This only records your review; it does not execute external actions.`)) return;
    setReviewingTask(task.id);
    setStatus("");
    try {
      const response = await fetch("/api/agents/tasks/approval", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, decision }),
      });
      const result: unknown = await response.json();
      if (!response.ok || !isRecord(result) || typeof result.status !== "string") {
        throw new Error(readError(result, "Your review could not be saved."));
      }
      setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: decision } : item));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Your review could not be saved.");
    } finally {
      setReviewingTask("");
    }
  }

  return (
    <section className="settings-page agents-page">
      <div className="page-heading">
        <div className="eyebrow"><span /> SPECIALISTS, COORDINATED BY PRIME</div>
        <h1>Agent workspace</h1>
        <p>Delegate a bounded request to a specialist, follow its handoff, and review the recommendation.</p>
      </div>

      <div className="privacy-callout agent-safety-callout">
        <ShieldCheck size={18} />
        <div>
          <strong>Human review stays in control.</strong>
          <p>These agents provide recommendations only. They have no tools, external-action permissions, or ability to run code. Approval records your review; it does not execute an action.</p>
        </div>
      </div>

      <div className="agent-directory">
        {agentRegistry.map((agent) => (
          <article className={`settings-card agent-card${selectedAgent === agent.id ? " agent-card-selected" : ""}`} key={agent.id}>
            <div className="agent-card-heading">
              <span className="settings-heading-icon"><Bot size={17} /></span>
              <span className="agent-status-dot" />
            </div>
            <h2>{agent.name}</h2>
            <p>{agent.responsibility}</p>
            <div className="agent-capability-list">
              {agent.capabilities.map((capability) => <span key={capability}>{capability}</span>)}
            </div>
            {agent.id === "prime" ? (
              <span className="agent-coordinator-label">Coordinator</span>
            ) : (
              <button className="button button-secondary" type="button" onClick={() => setSelectedAgent(agent.id)} aria-pressed={selectedAgent === agent.id}>
                {selectedAgent === agent.id ? "Selected" : "Select specialist"}
              </button>
            )}
          </article>
        ))}
      </div>

      <div className="agent-work-grid">
        <form className="settings-card agent-task-form" onSubmit={(event) => void submitTask(event)}>
          <div className="settings-card-heading">
            <span className="settings-heading-icon"><ArrowRight size={17} /></span>
            <div><h2>Delegate a task</h2><p>Prime will hand this request to your selected specialist.</p></div>
          </div>
          <label className="field-label">Specialist
            <select value={selectedAgent} onChange={(event) => setSelectedAgent(event.target.value)}>
              {specialistAgents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
            </select>
          </label>
          <label className="field-label">Task
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={4000} rows={5} required placeholder="Describe the question or deliverable for this specialist…" disabled={!databaseConnected || !aiConfigured} />
          </label>
          <button className="button button-primary" type="submit" disabled={!databaseConnected || !aiConfigured || isSubmitting || !prompt.trim()}>
            {isSubmitting ? <><LoaderCircle size={15} className="agent-spinner" /> Delegating…</> : <><ArrowRight size={15} /> Delegate to specialist</>}
          </button>
          {!databaseConnected && <p className="configuration-notice">Connect Supabase to save tasks and communication history.</p>}
          {databaseConnected && !aiConfigured && <p className="configuration-notice">Configure the server-side model gateway to enable delegation.</p>}
        </form>

        <div className="agent-task-list">
          <div className="settings-card-heading agent-list-heading">
            <span className="settings-heading-icon"><Bot size={17} /></span>
            <div><h2>Task progress</h2><p>Prime ↔ specialist handoffs, saved to your account.</p></div>
          </div>
          {!isReady ? (
            <div className="settings-card agent-empty">Loading your agent tasks…</div>
          ) : !tasks.length ? (
            <div className="settings-card agent-empty">
              <CircleAlert size={18} />
              <h3>No delegated tasks yet</h3>
              <p>Choose a specialist and delegate a question to start a tracked task.</p>
            </div>
          ) : tasks.map((task) => (
            <article className="settings-card agent-task-card" key={task.id}>
              <div className="agent-task-heading">
                <div><span className="agent-category">{task.agent}</span><h3>{task.title}</h3></div>
                <span className={`agent-task-status agent-task-status-${task.status}`}>{statusLabels[task.status]}</span>
              </div>
              <p className="agent-task-prompt">{task.prompt}</p>
              <div className="agent-handoff">
                {task.messages.map((message) => (
                  <div className={`agent-handoff-message agent-handoff-${message.sender_role}`} key={message.id}>
                    <strong>{message.sender_role === "prime" ? "Prime" : task.agent}</strong>
                    <p>{message.content}</p>
                  </div>
                ))}
              </div>
              {task.status === "awaiting_approval" && (
                <div className="agent-review-actions">
                  <button className="button button-primary" type="button" onClick={() => void decideTask(task, "approved")} disabled={reviewingTask === task.id}>
                    <Check size={14} /> Approve recommendation
                  </button>
                  <button className="button button-secondary" type="button" onClick={() => void decideTask(task, "rejected")} disabled={reviewingTask === task.id}>
                    <X size={14} /> Decline
                  </button>
                </div>
              )}
              {task.status === "approved" && <p className="agent-decision-note">You approved this recommendation. No external action was executed.</p>}
              {task.status === "rejected" && <p className="agent-decision-note">You declined this recommendation.</p>}
              {task.status === "failed" && <p className="agent-decision-note">This task failed. You can delegate it again after checking your model configuration.</p>}
              <time dateTime={task.created_at}>{new Date(task.created_at).toLocaleString()}</time>
            </article>
          ))}
        </div>
      </div>
      {status && <p className="settings-delete-status" role="status">{status}</p>}
    </section>
  );
}
