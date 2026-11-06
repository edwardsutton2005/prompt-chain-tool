"use client";

import { useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  GripVertical,
  ImagePlus,
  Loader2,
  MoreHorizontal,
  Play,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  EditorData,
  Execution,
  GeneratedMedia,
  LlmModel,
  PromptChain,
  PromptChainStep,
} from "@/lib/types";
import { cn } from "@/lib/utils";

async function api<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status}).`);
  return body;
}

function keyFromName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function SortableStep({
  step,
  selected,
  onSelect,
}: {
  step: PromptChainStep;
  selected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group flex items-center gap-2 rounded-lg border bg-card p-2.5 transition-colors",
        selected && "border-ring ring-1 ring-ring",
        isDragging && "z-20 opacity-70 shadow-lg"
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
        aria-label={`Reorder step ${step.position}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button type="button" className="min-w-0 flex-1 text-left" onClick={onSelect}>
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
            {step.position}
          </span>
          <span className="truncate text-sm font-medium">{step.name || `Untitled ${step.role} step`}</span>
        </div>
        <p className="mt-1 truncate pl-7 text-xs text-muted-foreground">{step.template}</p>
      </button>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

function StepEditor({
  step,
  chain,
  models,
  onSaved,
  onDeleted,
}: {
  step: PromptChainStep;
  chain: PromptChain;
  models: LlmModel[];
  onSaved: (step: PromptChainStep) => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState(step.name ?? "");
  const [role, setRole] = useState(step.role);
  const [template, setTemplate] = useState(step.template);
  const [modelId, setModelId] = useState(step.llm_model_id ?? "");
  const [temperature, setTemperature] = useState(
    String((step.configuration as Record<string, unknown>)?.temperature ?? "")
  );
  const [maxTokens, setMaxTokens] = useState(
    String((step.configuration as Record<string, unknown>)?.maxOutputTokens ?? "")
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const configuration: Record<string, number> = {};
      if (temperature !== "") configuration.temperature = Number(temperature);
      if (maxTokens !== "") configuration.maxOutputTokens = Number(maxTokens);
      const result = await api<{ step: PromptChainStep }>(`/api/steps/${step.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          role,
          template,
          llm_model_id: modelId || null,
          configuration,
        }),
      });
      onSaved(result.step);
      setMessage("Saved");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete this step? Previous execution history will be preserved.")) return;
    setBusy(true);
    try {
      await api(`/api/steps/${step.id}`, { method: "DELETE" });
      onDeleted();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Step {step.position}</p>
        <h2 className="mt-1 text-lg font-semibold">Configuration</h2>
      </div>
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">Name</span>
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Summarize the input" />
      </label>
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">Role</span>
        <select className="h-9 w-full rounded-lg border bg-background px-3 text-sm" value={role} onChange={(event) => setRole(event.target.value as PromptChainStep["role"])}>
          <option value="system">System</option>
          <option value="user">User</option>
          <option value="assistant">Assistant context</option>
        </select>
      </label>
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">Prompt template</span>
        <Textarea className="min-h-48 font-mono text-xs leading-5" value={template} onChange={(event) => setTemplate(event.target.value)} />
        <span className="text-xs text-muted-foreground">Variables: {"{{input}}"} and {"{{previous_output}}"}</span>
      </label>
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">Model</span>
        <select className="h-9 w-full rounded-lg border bg-background px-3 text-sm" value={modelId} onChange={(event) => setModelId(event.target.value)}>
          <option value="">Chain default</option>
          {models.map((model) => <option key={model.id} value={model.id}>{model.display_name}</option>)}
        </select>
        {!modelId && <span className="text-xs text-muted-foreground">Uses {models.find((model) => model.id === chain.default_model_id)?.display_name ?? "the chain default"}</span>}
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Temperature</span>
          <Input type="number" min="0" max="2" step="0.1" value={temperature} onChange={(event) => setTemperature(event.target.value)} placeholder="0.8" />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Max tokens</span>
          <Input type="number" min="1" max="8192" value={maxTokens} onChange={(event) => setMaxTokens(event.target.value)} placeholder="512" />
        </label>
      </div>
      <div className="flex items-center gap-2 border-t pt-4">
        <Button onClick={save} disabled={busy || !template.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
        </Button>
        <Button variant="ghost" size="icon" onClick={remove} disabled={busy} className="text-destructive" aria-label="Delete step">
          <Trash2 className="h-4 w-4" />
        </Button>
        {message && <span className={cn("text-xs", message === "Saved" ? "text-success" : "text-destructive")}>{message}</span>}
      </div>
    </div>
  );
}

export function PromptChainEditor({ initialData }: { initialData: EditorData }) {
  const [chains, setChains] = useState(initialData.chains);
  const [executions, setExecutions] = useState(initialData.executions);
  const [media, setMedia] = useState(initialData.media);
  const [selectedChainId, setSelectedChainId] = useState(initialData.chains[0]?.id ?? "");
  const [selectedStepId, setSelectedStepId] = useState(initialData.chains[0]?.steps[0]?.id ?? "");
  const [showCreate, setShowCreate] = useState(initialData.chains.length === 0);
  const [newName, setNewName] = useState("");
  const [newPurpose, setNewPurpose] = useState("custom");
  const [input, setInput] = useState("");
  const [image, setImage] = useState<{ name: string; mimeType: string; data: string } | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [runOutputs, setRunOutputs] = useState<Array<{ position: number; output: string }>>([]);
  const [finalOutput, setFinalOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const chain = chains.find((item) => item.id === selectedChainId) ?? chains[0];
  const selectedStep = chain?.steps.find((step) => step.id === selectedStepId) ?? chain?.steps[0];
  const chainExecutions = executions.filter((execution) => execution.prompt_chain_id === chain?.id);
  const chainMedia = media.filter((item) => item.prompt_chain_id === chain?.id);

  function updateChain(id: string, change: (chain: PromptChain) => PromptChain) {
    setChains((current) => current.map((item) => (item.id === id ? change(item) : item)));
  }

  async function createChain() {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const result = await api<{ chain: PromptChain }>("/api/chains", {
        method: "POST",
        body: JSON.stringify({
          name: newName,
          purpose: newPurpose,
          key: `${keyFromName(newName) || "chain"}-${Date.now().toString().slice(-6)}`,
          default_model_id: initialData.models[0]?.id ?? null,
        }),
      });
      setChains((current) => [result.chain, ...current]);
      setSelectedChainId(result.chain.id);
      setSelectedStepId("");
      setNewName("");
      setShowCreate(false);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not create chain.");
    } finally {
      setBusy(false);
    }
  }

  async function renameChain() {
    if (!chain) return;
    const name = window.prompt("Rename chain", chain.name)?.trim();
    if (!name || name === chain.name) return;
    try {
      const result = await api<{ chain: PromptChain }>(`/api/chains/${chain.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      updateChain(chain.id, (current) => ({ ...current, ...result.chain, steps: current.steps }));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not rename chain.");
    }
  }

  async function deleteChain() {
    if (!chain || !window.confirm(`Delete “${chain.name}”? Chains with execution history are archived.`)) return;
    try {
      await api(`/api/chains/${chain.id}`, { method: "DELETE" });
      const remaining = chains.filter((item) => item.id !== chain.id);
      setChains(remaining);
      setSelectedChainId(remaining[0]?.id ?? "");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not delete chain.");
    }
  }

  async function addStep() {
    if (!chain) return;
    const result = await api<{ step: PromptChainStep }>("/api/steps", {
      method: "POST",
      body: JSON.stringify({
        prompt_chain_id: chain.id,
        name: `Step ${chain.steps.length + 1}`,
        role: "user",
        template: chain.steps.length ? "Refine this result:\n\n{{previous_output}}" : "{{input}}",
        configuration: {},
      }),
    });
    updateChain(chain.id, (current) => ({ ...current, steps: [...current.steps, result.step] }));
    setSelectedStepId(result.step.id);
  }

  async function dragEnd(event: DragEndEvent) {
    if (!chain || !event.over || event.active.id === event.over.id) return;
    const from = chain.steps.findIndex((step) => step.id === event.active.id);
    const to = chain.steps.findIndex((step) => step.id === event.over?.id);
    const reordered = arrayMove(chain.steps, from, to).map((step, index) => ({ ...step, position: index + 1 }));
    updateChain(chain.id, (current) => ({ ...current, steps: reordered }));
    try {
      await api(`/api/chains/${chain.id}/reorder`, {
        method: "POST",
        body: JSON.stringify({ step_ids: reordered.map((step) => step.id) }),
      });
    } catch (error) {
      updateChain(chain.id, (current) => ({ ...current, steps: chain.steps }));
      window.alert(error instanceof Error ? error.message : "Could not reorder steps.");
    }
  }

  async function chooseImage(file?: File) {
    if (!file) return setImage(null);
    if (file.size > 5 * 1024 * 1024) return window.alert("Images must be 5 MB or smaller.");
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    setImage({ name: file.name, mimeType: file.type, data });
  }

  async function runChain() {
    if (!chain || !input.trim()) return;
    setRunning(true);
    setRunError("");
    setRunOutputs([]);
    setFinalOutput("");
    try {
      const result = await api<{
        requestId: string;
        outputs: Array<{ position: number; output: string }>;
        finalOutput: string;
        media: GeneratedMedia;
      }>("/api/execute", {
        method: "POST",
        body: JSON.stringify({
          chain_id: chain.id,
          input,
          image: image ? { mimeType: image.mimeType, data: image.data } : null,
        }),
      });
      setRunOutputs(result.outputs);
      setFinalOutput(result.finalOutput);
      setMedia((current) => [result.media, ...current]);
      const execution: Execution = {
        id: result.requestId,
        prompt_chain_id: chain.id,
        input_text: input,
        output_data: { finalOutput: result.finalOutput },
        status: "succeeded",
        error_message: null,
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      };
      setExecutions((current) => [execution, ...current]);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Execution failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="p-3 lg:p-4">
      <div className="grid min-h-[calc(100vh-5.5rem)] gap-3 xl:grid-cols-[260px_minmax(360px,1fr)_360px]">
        <Card className="flex min-h-72 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b p-3">
            <div><h2 className="text-sm font-semibold">Prompt chains</h2><p className="text-xs text-muted-foreground">{chains.length} configured</p></div>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setShowCreate((value) => !value)} aria-label="Create chain"><Plus className="h-4 w-4" /></Button>
          </div>
          {showCreate && (
            <div className="space-y-2 border-b bg-muted/30 p-3">
              <Input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Chain name" autoFocus />
              <Input value={newPurpose} onChange={(event) => setNewPurpose(event.target.value)} placeholder="Purpose" />
              <div className="flex gap-2"><Button size="sm" onClick={createChain} disabled={busy || !newName.trim()}>Create</Button><Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button></div>
            </div>
          )}
          <div className="flex-1 space-y-1 overflow-y-auto p-2">
            {chains.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn("w-full rounded-lg p-3 text-left transition-colors hover:bg-muted", item.id === chain?.id && "bg-secondary")}
                onClick={() => { setSelectedChainId(item.id); setSelectedStepId(item.steps[0]?.id ?? ""); }}
              >
                <div className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", item.active ? "bg-success" : "bg-muted-foreground")} /><span className="truncate text-sm font-medium">{item.name}</span></div>
                <p className="mt-1 truncate pl-4 text-xs text-muted-foreground">{item.purpose} · {item.steps.length} steps</p>
              </button>
            ))}
            {!chains.length && <p className="p-6 text-center text-sm text-muted-foreground">Create your first chain.</p>}
          </div>
        </Card>

        <div className="flex min-w-0 flex-col gap-3">
          <Card className="flex min-h-[420px] flex-1 flex-col overflow-hidden">
            {chain ? (
              <>
                <div className="flex flex-wrap items-center gap-2 border-b p-4">
                  <div className="min-w-0"><h2 className="truncate font-semibold">{chain.name}</h2><p className="text-xs text-muted-foreground">{chain.key} · version {chain.version}</p></div>
                  <div className="ml-auto flex gap-1">
                    <Button size="sm" variant="outline" onClick={addStep}><Plus className="h-3.5 w-3.5" /> Add step</Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={renameChain} aria-label="Rename chain"><MoreHorizontal className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={deleteChain} aria-label="Delete chain"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd}>
                  <SortableContext items={chain.steps.map((step) => step.id)} strategy={verticalListSortingStrategy}>
                    <div className="flex-1 space-y-2 overflow-y-auto p-4">
                      {chain.steps.map((step) => <SortableStep key={step.id} step={step} selected={step.id === selectedStep?.id} onSelect={() => setSelectedStepId(step.id)} />)}
                      {!chain.steps.length && <div className="rounded-xl border border-dashed p-10 text-center"><p className="text-sm font-medium">No steps yet</p><p className="mt-1 text-xs text-muted-foreground">Add a step to start building this chain.</p><Button size="sm" className="mt-4" onClick={addStep}><Plus className="h-4 w-4" /> Add first step</Button></div>}
                    </div>
                  </SortableContext>
                </DndContext>
              </>
            ) : <div className="grid flex-1 place-items-center text-sm text-muted-foreground">Select or create a prompt chain.</div>}
          </Card>

          {chain && (
            <Card className="p-4">
              <div className="mb-3 flex items-center gap-2"><Play className="h-4 w-4" /><h2 className="text-sm font-semibold">Execute chain</h2></div>
              <Textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Enter the initial input for {{input}}…" className="min-h-24" />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm hover:bg-muted">
                  <ImagePlus className="h-4 w-4" /> {image ? image.name : "Attach image"}
                  <input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseImage(event.target.files?.[0])} />
                </label>
                {image && <Button size="sm" variant="ghost" onClick={() => setImage(null)}>Remove</Button>}
                <Button className="ml-auto" onClick={runChain} disabled={running || !input.trim() || !chain.steps.length}>
                  {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} {running ? "Running…" : "Run chain"}
                </Button>
              </div>
              {(runError || runOutputs.length > 0) && (
                <div className="mt-4 space-y-3 border-t pt-4">
                  {runError && <div className="flex gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{runError}</div>}
                  {runOutputs.map((output) => <div key={output.position} className="rounded-lg bg-muted p-3"><p className="mb-1 text-xs font-medium text-muted-foreground">Step {output.position}</p><p className="whitespace-pre-wrap text-sm">{output.output}</p></div>)}
                  {finalOutput && <div className="rounded-lg border border-success/30 bg-success/5 p-3"><p className="mb-1 flex items-center gap-1 text-xs font-medium text-success"><CheckCircle2 className="h-3.5 w-3.5" /> Final output</p><p className="whitespace-pre-wrap text-sm">{finalOutput}</p></div>}
                </div>
              )}
            </Card>
          )}
        </div>

        <Card className="min-h-72 overflow-y-auto p-4">
          {chain && selectedStep ? (
            <StepEditor
              key={selectedStep.id}
              step={selectedStep}
              chain={chain}
              models={initialData.models}
              onSaved={(saved) => updateChain(chain.id, (current) => ({ ...current, steps: current.steps.map((step) => step.id === saved.id ? saved : step) }))}
              onDeleted={() => updateChain(chain.id, (current) => ({ ...current, steps: current.steps.filter((step) => step.id !== selectedStep.id).map((step, index) => ({ ...step, position: index + 1 })) }))}
            />
          ) : <div className="grid h-full min-h-64 place-items-center text-center text-sm text-muted-foreground">Select a step to configure it.</div>}
        </Card>
      </div>

      {chain && (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">Previous executions</h2><span className="text-xs text-muted-foreground">{chainExecutions.length}</span></div>
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {chainExecutions.map((execution) => (
                <details key={execution.id} className="rounded-lg border p-3">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-sm">
                    {execution.status === "succeeded" ? <CheckCircle2 className="h-4 w-4 text-success" /> : execution.status === "failed" ? <AlertCircle className="h-4 w-4 text-destructive" /> : <Clock3 className="h-4 w-4 text-muted-foreground" />}
                    <span className="truncate">{execution.input_text || "No text input"}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{new Date(execution.created_at).toLocaleString()}</span>
                  </summary>
                  <div className="mt-3 border-t pt-3 text-xs">
                    {execution.error_message && <p className="text-destructive">{execution.error_message}</p>}
                    {execution.step_runs?.map((run) => <div key={run.id} className="mt-2 rounded bg-muted p-2"><p className="font-medium">Step {run.step_position}</p><p className="mt-1 whitespace-pre-wrap text-muted-foreground">{run.output_text || run.error_message}</p></div>)}
                  </div>
                </details>
              ))}
              {!chainExecutions.length && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No executions for this chain yet.</p>}
            </div>
          </Card>
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">Generated media</h2><span className="text-xs text-muted-foreground">{chainMedia.length}</span></div>
            <div className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2">
              {chainMedia.map((item) => (
                <div key={item.id} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground"><span className="rounded bg-muted px-1.5 py-0.5 uppercase">{item.media_kind}</span><span>{new Date(item.created_at).toLocaleDateString()}</span></div>
                  {item.text_content && <p className="line-clamp-5 whitespace-pre-wrap text-sm">{item.text_content}</p>}
                  {item.media_kind === "gif" && item.external_url && (
                    // eslint-disable-next-line @next/next/no-img-element -- Giphy media is selected at runtime.
                    <img src={item.external_url} alt="Generated GIF result" className="mt-2 max-h-40 w-full rounded-md object-cover" />
                  )}
                  {item.external_url && <a className="text-sm underline" href={item.external_url} target="_blank" rel="noreferrer">Open media</a>}
                </div>
              ))}
              {!chainMedia.length && <p className="col-span-full rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Generated outputs will appear here.</p>}
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
