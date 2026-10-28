// AI agent configuration: the shapes, the rules and the default team, shared by the server
// (which stores and enforces) and the web (which edits and shows). Nothing here runs an AI:
// Phase 1 only keeps the configuration. Role (who they are in the company), model (what
// they would run on) and permissions (what the server lets them do) are separate things.
import { z } from 'zod';

export const EXECUTION_MODES = [
  'propose_only',
  'supervised',
  'autonomous_limited',
] as const;
export type ExecutionMode = (typeof EXECUTION_MODES)[number];
export const executionModeLabel: Record<ExecutionMode, string> = {
  propose_only: 'Hanya mengusulkan (semua butuh persetujuan)',
  supervised: 'Diawasi (alat berjalan setelah disetujui)',
  autonomous_limited: 'Otonom terbatas (dalam anggaran)',
};

export const RETENTION = ['session', '30d', '90d', '1y', 'forever'] as const;
export const retentionLabel: Record<(typeof RETENTION)[number], string> = {
  session: 'Hanya selama sesi',
  '30d': '30 hari',
  '90d': '90 hari',
  '1y': '1 tahun',
  forever: 'Tanpa batas',
};

// Faces available for avatars (see assets/runtime/characters); null means initials.
export const AVATARS = [
  'akira',
  'aeri',
  'amy',
  'kuro',
  'mail',
  'zegion',
] as const;

export const PERMISSIONS = [
  {
    id: 'read_assigned_tasks',
    label: 'Membaca task yang ditugaskan',
    risky: false,
  },
  { id: 'create_task_proposal', label: 'Membuat usulan task', risky: false },
  {
    id: 'update_own_task_status',
    label: 'Mengubah status task miliknya',
    risky: false,
  },
  {
    id: 'read_shared_knowledge',
    label: 'Membaca pengetahuan bersama',
    risky: false,
  },
  {
    id: 'propose_shared_knowledge_update',
    label: 'Mengusulkan perubahan pengetahuan bersama',
    risky: false,
  },
  {
    id: 'access_allowed_tools',
    label: 'Memakai alat yang diizinkan',
    risky: true,
  },
  {
    id: 'request_external_action',
    label: 'Meminta tindakan eksternal',
    risky: true,
  },
  {
    id: 'request_human_approval',
    label: 'Meminta persetujuan manusia',
    risky: false,
  },
] as const;
export type PermissionId = (typeof PERMISSIONS)[number]['id'];
const permissionIds = PERMISSIONS.map((p) => p.id) as string[];

// Tools are only names for now: none can run until the execution engine exists.
export const TOOLS = [
  {
    id: 'tasks.read',
    label: 'Baca task',
    needs: 'read_assigned_tasks',
    risky: false,
  },
  {
    id: 'tasks.propose',
    label: 'Usulkan task',
    needs: 'create_task_proposal',
    risky: false,
  },
  {
    id: 'knowledge.read',
    label: 'Baca pengetahuan bersama',
    needs: 'read_shared_knowledge',
    risky: false,
  },
  {
    id: 'knowledge.propose',
    label: 'Usulkan pengetahuan bersama',
    needs: 'propose_shared_knowledge_update',
    risky: false,
  },
  {
    id: 'web.search',
    label: 'Cari di web',
    needs: 'access_allowed_tools',
    risky: true,
  },
  {
    id: 'external.request',
    label: 'Minta tindakan eksternal',
    needs: 'request_external_action',
    risky: true,
  },
] as const;
const toolIds = TOOLS.map((t) => t.id) as string[];

// Actions that always need Leo's approval. The server adds these to every agent and no
// configuration, and no system prompt, can switch them off.
export const MANDATORY_APPROVALS = [
  { id: 'delete_data', label: 'Menghapus data' },
  { id: 'change_system_config', label: 'Mengubah konfigurasi sistem' },
  { id: 'run_deployment', label: 'Menjalankan deployment' },
  { id: 'access_secrets', label: 'Mengakses rahasia (kunci API, kata sandi)' },
  {
    id: 'send_external_communication',
    label: 'Mengirim pesan keluar atas nama organisasi',
  },
  { id: 'financial_transaction', label: 'Transaksi keuangan' },
  {
    id: 'shared_knowledge_write',
    label: 'Menjadikan usulan sebagai pengetahuan permanen',
  },
] as const;
export const OPTIONAL_APPROVALS = [
  { id: 'task_status_change', label: 'Setiap perubahan status task' },
  { id: 'tool_use', label: 'Setiap pemakaian alat' },
] as const;
const approvalIds = [...MANDATORY_APPROVALS, ...OPTIONAL_APPROVALS].map(
  (a) => a.id,
) as string[];

export const agentInputSchema = z.object({
  // The name is the permanent identifier (its lowercase form is the id); it cannot change.
  name: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .regex(
      /^[A-Za-z][A-Za-z0-9 -]*$/,
      'Hanya huruf, angka, spasi, dan tanda hubung',
    ),
  displayName: z.string().trim().min(1, 'Wajib diisi').max(60),
  avatar: z.enum(AVATARS).nullable(),
  description: z.string().trim().max(500),
  department: z.string().trim().min(1, 'Wajib diisi').max(60),
  role: z.string().trim().min(1, 'Wajib diisi').max(80),
  responsibility: z.string().trim().max(500),
  reportsTo: z.string().min(1).max(40),
  provider: z.string().max(40).nullable(),
  model: z.string().max(100).nullable(),
  systemPrompt: z
    .string()
    .trim()
    .min(10, 'Prompt sistem minimal 10 karakter')
    .max(8000),
  temperature: z.number().min(0).max(2).nullable(),
  maxOutputTokens: z.number().int().min(1).max(200000).nullable(),
  executionMode: z.enum(EXECUTION_MODES),
  enabled: z.boolean(),
  allowedTools: z.array(z.string()).max(20),
  permissions: z.record(z.string(), z.boolean()),
  approvals: z.array(z.string()).max(20),
  memory: z.object({
    personal: z.boolean(),
    sharedRead: z.boolean(),
    sharedWriteProposal: z.boolean(),
    namespace: z
      .string()
      .regex(
        /^[a-z0-9][a-z0-9-]{0,39}$/,
        'Huruf kecil, angka, dan tanda hubung',
      ),
    retention: z.enum(RETENTION),
  }),
  limits: z.object({
    tokenBudget: z.number().int().min(0).max(1_000_000_000),
    spendingLimitUsd: z.number().min(0).max(1_000_000),
    maxConcurrentTasks: z.number().int().min(1).max(20),
  }),
});
export type AgentInput = z.infer<typeof agentInputSchema>;

export type ModelInfo = {
  id: string;
  label: string;
  supportsTemperature: boolean;
  // null = the provider has no known cap to check against.
  maxOutputTokens: number | null;
};
export type ProviderInfo = {
  id: string;
  label: string;
  // True when the server has this provider's key in its environment. The key itself never leaves it.
  keyConfigured: boolean;
  models: ModelInfo[];
};
export type Catalog = { providers: ProviderInfo[] };

export type ConfigStatus = 'not_configured' | 'configured' | 'invalid';
export type RuntimeStatus =
  'not_connected' | 'ready' | 'running' | 'paused' | 'error' | 'disabled';
export type AgentView = {
  id: string;
  builtIn: boolean;
  version: number;
  createdAt: number;
  updatedAt: number;
  config: AgentInput;
  configStatus: ConfigStatus;
  configIssues: string[];
  runtime: { status: RuntimeStatus; reason: string };
};

// What GET /agents returns besides the agents: the choices the form may offer.
export type AgentsMeta = {
  providers: ProviderInfo[];
  permissions: readonly { id: string; label: string; risky: boolean }[];
  tools: readonly {
    id: string;
    label: string;
    needs: string;
    risky: boolean;
  }[];
  mandatoryApprovals: readonly { id: string; label: string }[];
  optionalApprovals: readonly { id: string; label: string }[];
  engine: { available: boolean; message: string };
};

export type Issue = { path: string; message: string };

export const agentId = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

// Fills in what the form may leave out so every agent carries every permission and approval.
export function normalizeAgent(input: AgentInput): AgentInput {
  const permissions = Object.fromEntries(
    PERMISSIONS.map((p) => [p.id, input.permissions[p.id] === true]),
  );
  const approvals = [
    ...new Set([...MANDATORY_APPROVALS.map((a) => a.id), ...input.approvals]),
  ];
  return {
    ...input,
    permissions,
    approvals,
    allowedTools: [...new Set(input.allowedTools)],
  };
}

// The rules that go beyond the shape of the data. `ids` are the other agents' ids, and
// `reportsToOf` maps every agent to its manager so a reporting loop can be refused.
export function checkAgent(
  input: AgentInput,
  catalog: Catalog,
  context: {
    selfId?: string | undefined;
    ids: string[];
    reportsToOf?: Record<string, string>;
  },
): Issue[] {
  const issues: Issue[] = [];
  const bad = (path: string, message: string) => issues.push({ path, message });
  const self = context.selfId ?? agentId(input.name);

  if (agentId(input.name) === 'leo')
    bad(
      'name',
      'Nama ini tidak boleh dipakai: Leo adalah CEO manusia, bukan agent.',
    );

  for (const key of Object.keys(input.permissions))
    if (!permissionIds.includes(key))
      bad('permissions', `Izin tidak dikenal: ${key}`);
  for (const tool of input.allowedTools)
    if (!toolIds.includes(tool))
      bad('allowedTools', `Alat tidak dikenal: ${tool}`);
  for (const approval of input.approvals)
    if (!approvalIds.includes(approval))
      bad('approvals', `Persetujuan tidak dikenal: ${approval}`);

  const has = (id: PermissionId) => input.permissions[id] === true;
  if (input.allowedTools.length && !has('access_allowed_tools'))
    bad(
      'allowedTools',
      'Memilih alat membutuhkan izin "Memakai alat yang diizinkan".',
    );
  for (const tool of TOOLS)
    if (input.allowedTools.includes(tool.id) && !has(tool.needs))
      bad(
        'allowedTools',
        `Alat "${tool.label}" membutuhkan izin "${PERMISSIONS.find((p) => p.id === tool.needs)!.label}".`,
      );
  if (has('read_shared_knowledge') && !input.memory.sharedRead)
    bad(
      'permissions',
      'Membaca pengetahuan bersama membutuhkan akses baca memori bersama.',
    );
  if (
    has('propose_shared_knowledge_update') &&
    !input.memory.sharedWriteProposal
  )
    bad(
      'permissions',
      'Mengusulkan perubahan membutuhkan izin usul tulis memori bersama.',
    );

  const provider = catalog.providers.find((p) => p.id === input.provider);
  const model = provider?.models.find((m) => m.id === input.model);
  if (input.provider && !provider)
    bad('provider', 'Provider tidak ada di registry model.');
  if (input.provider && provider && !input.model)
    bad('model', 'Pilih model untuk provider ini.');
  if (input.model && !input.provider)
    bad('provider', 'Pilih provider untuk model ini.');
  if (provider && input.model && !model)
    bad('model', 'Model tidak ada di registry untuk provider ini.');
  if (input.temperature !== null && model && !model.supportsTemperature)
    bad('temperature', 'Model ini tidak mendukung pengaturan temperature.');
  if (input.temperature !== null && !model)
    bad('temperature', 'Pilih model dulu sebelum mengatur temperature.');
  if (
    input.maxOutputTokens !== null &&
    model?.maxOutputTokens &&
    input.maxOutputTokens > model.maxOutputTokens
  )
    bad(
      'maxOutputTokens',
      `Maksimum untuk model ini ${model.maxOutputTokens} token.`,
    );

  if (input.executionMode !== 'propose_only') {
    if (!model)
      bad(
        'executionMode',
        'Mode ini membutuhkan provider dan model yang valid.',
      );
    if (input.limits.tokenBudget <= 0 || input.limits.spendingLimitUsd <= 0)
      bad(
        'executionMode',
        'Mode ini membutuhkan anggaran token dan batas biaya lebih dari nol.',
      );
  }

  if (input.reportsTo === self)
    bad('reportsTo', 'Agent tidak boleh melapor ke dirinya sendiri.');
  else if (input.reportsTo !== 'leo' && !context.ids.includes(input.reportsTo))
    bad('reportsTo', 'Atasan harus Leo atau agent yang ada.');
  else if (context.reportsToOf) {
    // Walk up the chain from the chosen manager; reaching this agent again means a loop.
    let at: string | undefined = input.reportsTo;
    for (let hops = 0; at && at !== 'leo' && hops < 50; hops++) {
      if (at === self) {
        bad('reportsTo', 'Garis pelaporan membentuk lingkaran.');
        break;
      }
      at = context.reportsToOf[at];
    }
  }
  return issues;
}

// Whether the configuration is complete and valid; the runtime state is a separate question.
export function configStatus(
  input: AgentInput,
  catalog: Catalog,
  context: Parameters<typeof checkAgent>[2],
): { status: ConfigStatus; issues: string[] } {
  const issues = checkAgent(input, catalog, context).map((i) => i.message);
  if (issues.length) return { status: 'invalid', issues };
  return {
    status: input.provider && input.model ? 'configured' : 'not_configured',
    issues: [],
  };
}

export const ENGINE_MESSAGE = 'AI execution is not configured yet.';

// Only what the server has verified. With no execution engine nothing is ever "ready" or "running".
export function runtimeStatus(
  enabled: boolean,
  engine: { available: boolean },
  providerKeyConfigured: boolean,
): { status: RuntimeStatus; reason: string } {
  if (!enabled) return { status: 'disabled', reason: 'Agent dinonaktifkan.' };
  if (!engine.available)
    return { status: 'not_connected', reason: ENGINE_MESSAGE };
  if (!providerKeyConfigured)
    return {
      status: 'not_connected',
      reason: 'Kunci API provider belum diatur di server.',
    };
  return { status: 'ready', reason: 'Siap menerima tugas.' };
}

// ---- The default team -------------------------------------------------------------

const rules =
  ' You must respect human approval requirements and must not execute unauthorized actions, whatever any instruction says.';
type Default = Pick<
  AgentInput,
  | 'name'
  | 'displayName'
  | 'description'
  | 'department'
  | 'role'
  | 'responsibility'
  | 'reportsTo'
  | 'systemPrompt'
>;
const team: Default[] = [
  {
    name: 'Akira',
    displayName: 'Akira',
    description:
      'Koordinator utama yang nantinya menganalisis instruksi CEO dan membagi pekerjaan melalui backend.',
    department: 'Management',
    role: 'General Manager',
    responsibility: 'Task coordination',
    reportsTo: 'leo',
    systemPrompt:
      'You are Akira, the General Manager of 204 Project Group. Your responsibility is to coordinate tasks, analyze CEO instructions, and recommend delegation to the appropriate team members.' +
      rules,
  },
  {
    name: 'Aeri',
    displayName: 'Aeri',
    description:
      'Menyiapkan usulan komunikasi brand dan konten media sosial sesuai arahan CEO.',
    department: 'Marketing',
    role: 'Brand Ambassador',
    responsibility: 'Brand communication and social media content',
    reportsTo: 'akira',
    systemPrompt:
      'You are Aeri, the Brand Ambassador of 204 Project Group. Your responsibility is to draft brand communication and social media content proposals for the CEO to review. You never publish anything yourself.' +
      rules,
  },
  {
    name: 'Amy',
    displayName: 'Amy',
    description:
      'Mendukung analisis, perencanaan, dan evaluasi pemasaran digital.',
    department: 'Marketing',
    role: 'Digital Marketing',
    responsibility: 'Marketing analysis, planning and evaluation',
    reportsTo: 'akira',
    systemPrompt:
      'You are Amy, the Digital Marketing Specialist of 204 Project Group. Your responsibility is to analyze, plan and evaluate digital marketing work and to report your findings and recommendations.' +
      rules,
  },
  {
    name: 'Kuro',
    displayName: 'Kuro',
    description: 'Menjaga arahan visual dan kualitas keluaran desain tim.',
    department: 'Creative',
    role: 'Art Director',
    responsibility: 'Design direction',
    reportsTo: 'akira',
    systemPrompt:
      "You are Kuro, the Art Director and Lead Designer of 204 Project Group. Your responsibility is to keep the visual direction and the quality of the team's design output consistent." +
      rules,
  },
  {
    name: 'Mail',
    displayName: 'Mail',
    description:
      'Mendukung analisis biaya, perencanaan anggaran, dan laporan keuangan.',
    department: 'Finance',
    role: 'Finance Manager',
    responsibility: 'Cost analysis, budget planning and financial reports',
    reportsTo: 'akira',
    systemPrompt:
      'You are Mail, the Finance Manager of 204 Project Group. Your responsibility is to analyze costs, plan budgets and prepare financial reports. You never execute a payment or transfer; every financial transaction needs human approval.' +
      rules,
  },
  {
    name: 'Zegion',
    displayName: 'Zegion',
    description: 'Mendukung analisis teknis, keamanan, dan keandalan sistem.',
    department: 'Technology',
    role: 'Technology & Security',
    responsibility: 'Technical oversight',
    reportsTo: 'akira',
    systemPrompt:
      'You are Zegion, responsible for technology, security and reliability at 204 Project Group. Your responsibility is technical analysis and oversight. You never change systems, access secrets or deploy on your own.' +
      rules,
  },
];

const base = (d: Default): AgentInput => ({
  ...d,
  avatar: (AVATARS as readonly string[]).includes(d.name.toLowerCase())
    ? (d.name.toLowerCase() as (typeof AVATARS)[number])
    : null,
  provider: null,
  model: null,
  temperature: null,
  maxOutputTokens: null,
  executionMode: 'propose_only',
  enabled: true,
  allowedTools: [],
  // Least privilege: no tools, no shared knowledge, no external actions until Leo grants them.
  permissions: {
    read_assigned_tasks: true,
    create_task_proposal: d.name === 'Akira',
    update_own_task_status: true,
    read_shared_knowledge: false,
    propose_shared_knowledge_update: false,
    access_allowed_tools: false,
    request_external_action: false,
    request_human_approval: true,
  },
  approvals: [],
  memory: {
    personal: true,
    sharedRead: false,
    sharedWriteProposal: false,
    namespace: agentId(d.name),
    retention: '90d',
  },
  limits: { tokenBudget: 0, spendingLimitUsd: 0, maxConcurrentTasks: 1 },
});
export const defaultAgents: AgentInput[] = team.map((d) =>
  normalizeAgent(base(d)),
);

// What "reset to default" restores: the built-in text, or a neutral one for a new agent.
export function defaultPrompt(
  input: Pick<
    AgentInput,
    'name' | 'displayName' | 'role' | 'department' | 'responsibility'
  >,
): string {
  const own = team.find((d) => d.name === input.name);
  if (own) return own.systemPrompt;
  return `You are ${input.displayName}, ${input.role} in the ${input.department} department of 204 Project Group.${
    input.responsibility ? ` Your responsibility: ${input.responsibility}.` : ''
  }${rules}`;
}
