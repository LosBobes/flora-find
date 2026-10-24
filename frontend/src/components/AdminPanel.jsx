import { useCallback, useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { api } from '../api'
import { useAuth } from '../AuthContext'
import { cn } from '../lib/utils'

// Full-screen admin console for site admins: dashboard stats, user management,
// moderation over every plant/area (delete anything), and a read-only SQL
// console for ad-hoc lookups. Rendered as a full-viewport overlay (not the
// mobile-only Drawer) so it's usable on desktop and phone alike. Every call it
// makes is admin-gated on the backend; a non-admin never sees the launcher.

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'entries', label: 'Entries' },
  { id: 'areas', label: 'Areas' },
  { id: 'sql', label: 'SQL' },
]

function formatDate(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return value
  }
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

function ErrorText({ children }) {
  if (!children) return null
  return <p className="text-sm font-medium text-red-600 dark:text-red-400">{children}</p>
}

function StatCard({ label, value, accent }) {
  return (
    <div className="rounded-2xl border border-forest-100 bg-forest-50/70 p-4 dark:border-white/10 dark:bg-white/5">
      <p className={cn('text-3xl font-extrabold', accent ? 'text-orange-500' : 'text-forest-700 dark:text-forest-100')}>
        {value ?? '—'}
      </p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-forest-500 dark:text-forest-300">
        {label}
      </p>
    </div>
  )
}

function OverviewTab() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    api
      .adminStats()
      .then((data) => alive && setStats(data))
      .catch((err) => alive && setError(err.message))
    return () => {
      alive = false
    }
  }, [])

  if (error) return <ErrorText>{error}</ErrorText>
  if (!stats) return <p className="text-sm text-forest-500">Loading…</p>

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <StatCard label="Users" value={stats.users} />
      <StatCard label="Admins" value={stats.admins} accent />
      <StatCard label="Plants" value={stats.trees} />
      <StatCard label="Areas" value={stats.areas} />
      <StatCard label="Confirmations" value={stats.confirmations} />
      <StatCard label="Photos" value={stats.photos} />
      <StatCard label="Plant types" value={stats.plant_types} />
      <StatCard label="Flagged gone" value={stats.flagged_trees} accent={stats.flagged_trees > 0} />
    </div>
  )
}

// A search box + reusable table shell. `render` draws the header + rows.
function SearchBar({ value, onChange, placeholder, children }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <input
        className="flex-1 rounded-xl border border-forest-100 bg-white px-3 py-2 text-sm text-forest-900 shadow-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 dark:border-white/10 dark:bg-white/5 dark:text-forest-50 dark:placeholder-forest-300"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {children}
    </div>
  )
}

function IconButton({ onClick, title, danger, children, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-lg border text-xs font-semibold transition disabled:opacity-40',
        danger
          ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'
          : 'border-forest-200 bg-white text-forest-600 hover:bg-forest-50 dark:border-white/15 dark:bg-white/5 dark:text-forest-200 dark:hover:bg-white/10',
      )}
    >
      {children}
    </button>
  )
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    </svg>
  )
}

const cellHead = 'px-3 py-2 text-left font-semibold text-forest-600 dark:text-forest-300'
const cellBody = 'px-3 py-2 text-forest-800 dark:text-forest-100'

function TableWrap({ children }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-forest-100 dark:border-white/10">
      <table className="w-full min-w-[540px] border-collapse text-sm">{children}</table>
    </div>
  )
}

function UsersTab() {
  const { user: me } = useAuth()
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState(null)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback((q) => {
    setError(null)
    api
      .adminUsers(q)
      .then(setUsers)
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    const handle = setTimeout(() => load(query), 250)
    return () => clearTimeout(handle)
  }, [query, load])

  async function toggleAdmin(u) {
    setBusyId(u.id)
    setError(null)
    try {
      await api.adminSetUserRole(u.id, !u.is_admin)
      load(query)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function remove(u) {
    if (!window.confirm(`Delete user “${u.username}” and all ${u.tree_count} plants + ${u.area_count} areas they added? This cannot be undone.`)) return
    setBusyId(u.id)
    setError(null)
    try {
      await api.adminDeleteUser(u.id)
      load(query)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <SearchBar value={query} onChange={setQuery} placeholder="Search users by name or email…" />
      <ErrorText>{error}</ErrorText>
      {!users ? (
        <p className="text-sm text-forest-500">Loading…</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-forest-500">No users found.</p>
      ) : (
        <TableWrap>
          <thead className="bg-forest-50/70 dark:bg-white/5">
            <tr>
              <th className={cellHead}>ID</th>
              <th className={cellHead}>Username</th>
              <th className={cellHead}>Email</th>
              <th className={cellHead}>Joined</th>
              <th className={cellHead}>Plants</th>
              <th className={cellHead}>Areas</th>
              <th className={cellHead}>Role</th>
              <th className={cellHead} />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-forest-100 dark:border-white/10">
                <td className={cellBody}>{u.id}</td>
                <td className={cn(cellBody, 'font-semibold')}>{u.username}</td>
                <td className={cellBody}>{u.email}</td>
                <td className={cellBody}>{formatDate(u.created_at)}</td>
                <td className={cellBody}>{u.tree_count}</td>
                <td className={cellBody}>{u.area_count}</td>
                <td className={cellBody}>
                  <button
                    type="button"
                    onClick={() => toggleAdmin(u)}
                    disabled={busyId === u.id || u.id === me?.id}
                    title={u.id === me?.id ? 'You cannot change your own role' : 'Toggle admin'}
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase transition disabled:cursor-not-allowed disabled:opacity-60',
                      u.is_admin
                        ? 'bg-orange-500 text-white hover:bg-orange-600'
                        : 'border border-forest-200 text-forest-600 hover:bg-forest-50 dark:border-white/15 dark:text-forest-200 dark:hover:bg-white/10',
                    )}
                  >
                    {u.is_admin ? 'admin' : 'user'}
                  </button>
                </td>
                <td className={cellBody}>
                  <IconButton
                    onClick={() => remove(u)}
                    title="Delete user"
                    danger
                    disabled={busyId === u.id || u.id === me?.id}
                  >
                    <TrashIcon />
                  </IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  )
}

function EntriesTab() {
  const [query, setQuery] = useState('')
  const [flagged, setFlagged] = useState(false)
  const [trees, setTrees] = useState(null)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback((q, onlyFlagged) => {
    setError(null)
    api
      .adminTrees({ q, flagged: onlyFlagged })
      .then(setTrees)
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    const handle = setTimeout(() => load(query, flagged), 250)
    return () => clearTimeout(handle)
  }, [query, flagged, load])

  async function remove(tree) {
    if (!window.confirm(`Delete plant “${tree.name}”? This cannot be undone.`)) return
    setBusyId(tree.id)
    setError(null)
    try {
      await api.adminDeleteTree(tree.id)
      load(query, flagged)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <SearchBar value={query} onChange={setQuery} placeholder="Search plants by name, type or species…">
        <label className="flex items-center gap-2 text-sm font-medium text-forest-700 dark:text-forest-200">
          <input type="checkbox" checked={flagged} onChange={(e) => setFlagged(e.target.checked)} className="size-4 accent-orange-500" />
          Flagged only
        </label>
      </SearchBar>
      <ErrorText>{error}</ErrorText>
      {!trees ? (
        <p className="text-sm text-forest-500">Loading…</p>
      ) : trees.length === 0 ? (
        <p className="text-sm text-forest-500">No plants found.</p>
      ) : (
        <TableWrap>
          <thead className="bg-forest-50/70 dark:bg-white/5">
            <tr>
              <th className={cellHead}>ID</th>
              <th className={cellHead}>Name</th>
              <th className={cellHead}>Category</th>
              <th className={cellHead}>Type</th>
              <th className={cellHead}>Owner</th>
              <th className={cellHead}>Added</th>
              <th className={cellHead}>Status</th>
              <th className={cellHead} />
            </tr>
          </thead>
          <tbody>
            {trees.map((tree) => (
              <tr key={tree.id} className="border-t border-forest-100 dark:border-white/10">
                <td className={cellBody}>{tree.id}</td>
                <td className={cn(cellBody, 'font-semibold')}>{tree.name}</td>
                <td className={cellBody}>{tree.category}</td>
                <td className={cellBody}>{tree.fruit_type}</td>
                <td className={cellBody}>{tree.owner?.username ?? '—'}</td>
                <td className={cellBody}>{formatDate(tree.created_at)}</td>
                <td className={cellBody}>
                  <span className="flex flex-wrap gap-1">
                    {tree.hazard && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-600 dark:bg-red-500/20 dark:text-red-300">
                        hazard
                      </span>
                    )}
                    {tree.flagged_gone ? (
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold uppercase text-orange-600 dark:bg-orange-500/20 dark:text-orange-300">
                        gone ×{tree.gone_reports}
                      </span>
                    ) : (
                      !tree.hazard && <span className="text-xs text-forest-400">ok</span>
                    )}
                  </span>
                </td>
                <td className={cellBody}>
                  <IconButton onClick={() => remove(tree)} title="Delete plant" danger disabled={busyId === tree.id}>
                    <TrashIcon />
                  </IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  )
}

function AreasTab() {
  const [query, setQuery] = useState('')
  const [areas, setAreas] = useState(null)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback((q) => {
    setError(null)
    api
      .adminAreas(q)
      .then(setAreas)
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    const handle = setTimeout(() => load(query), 250)
    return () => clearTimeout(handle)
  }, [query, load])

  async function remove(area) {
    if (!window.confirm(`Delete area “${area.name}”? This cannot be undone.`)) return
    setBusyId(area.id)
    setError(null)
    try {
      await api.adminDeleteArea(area.id)
      load(query)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <SearchBar value={query} onChange={setQuery} placeholder="Search areas by name or type…" />
      <ErrorText>{error}</ErrorText>
      {!areas ? (
        <p className="text-sm text-forest-500">Loading…</p>
      ) : areas.length === 0 ? (
        <p className="text-sm text-forest-500">No areas found.</p>
      ) : (
        <TableWrap>
          <thead className="bg-forest-50/70 dark:bg-white/5">
            <tr>
              <th className={cellHead}>ID</th>
              <th className={cellHead}>Name</th>
              <th className={cellHead}>Category</th>
              <th className={cellHead}>Type</th>
              <th className={cellHead}>Owner</th>
              <th className={cellHead}>Added</th>
              <th className={cellHead} />
            </tr>
          </thead>
          <tbody>
            {areas.map((area) => (
              <tr key={area.id} className="border-t border-forest-100 dark:border-white/10">
                <td className={cellBody}>{area.id}</td>
                <td className={cn(cellBody, 'font-semibold')}>{area.name}</td>
                <td className={cellBody}>{area.category}</td>
                <td className={cellBody}>{area.fruit_type}</td>
                <td className={cellBody}>{area.owner?.username ?? '—'}</td>
                <td className={cellBody}>{formatDate(area.created_at)}</td>
                <td className={cellBody}>
                  <IconButton onClick={() => remove(area)} title="Delete area" danger disabled={busyId === area.id}>
                    <TrashIcon />
                  </IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  )
}

const SQL_SAMPLES = [
  'SELECT category, COUNT(*) AS n FROM trees GROUP BY category ORDER BY n DESC',
  'SELECT username, email, created_at FROM users ORDER BY created_at DESC',
  'SELECT name, fruit_type, lat, lng FROM trees ORDER BY created_at DESC LIMIT 20',
]

function SqlTab() {
  const [sql, setSql] = useState(SQL_SAMPLES[0])
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    setError(null)
    try {
      const data = await api.adminSql(sql)
      setResult(data)
    } catch (err) {
      setError(err.message)
      setResult(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-forest-500 dark:text-forest-300">
        Read-only console. Only a single <code className="font-mono">SELECT</code> / <code className="font-mono">WITH</code> query runs; writes and DDL are rejected.
      </p>
      <textarea
        value={sql}
        onChange={(event) => setSql(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') run()
        }}
        spellCheck={false}
        rows={4}
        className="w-full rounded-xl border border-forest-100 bg-white px-3 py-2 font-mono text-sm text-forest-900 shadow-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 dark:border-white/10 dark:bg-white/5 dark:text-forest-50"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="inline-flex items-center justify-center rounded-xl bg-forest-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-700 disabled:opacity-60"
        >
          {busy ? 'Running…' : 'Run query'}
        </button>
        <span className="text-xs text-forest-400">⌘/Ctrl + Enter</span>
        <div className="ml-auto flex flex-wrap gap-1">
          {SQL_SAMPLES.map((sample, i) => (
            <button
              key={sample}
              type="button"
              onClick={() => setSql(sample)}
              className="rounded-lg border border-forest-200 bg-white px-2 py-1 text-[11px] font-medium text-forest-600 transition hover:bg-forest-50 dark:border-white/15 dark:bg-white/5 dark:text-forest-200 dark:hover:bg-white/10"
            >
              Sample {i + 1}
            </button>
          ))}
        </div>
      </div>
      <ErrorText>{error}</ErrorText>
      {result && (
        <div>
          <p className="mb-2 text-xs font-semibold text-forest-500 dark:text-forest-300">
            {result.row_count} row{result.row_count === 1 ? '' : 's'}
            {result.truncated && ' (truncated to first 500)'}
          </p>
          {result.columns.length === 0 || result.row_count === 0 ? (
            <p className="text-sm text-forest-500">No rows.</p>
          ) : (
            <TableWrap>
              <thead className="bg-forest-50/70 dark:bg-white/5">
                <tr>
                  {result.columns.map((col) => (
                    <th key={col} className={cn(cellHead, 'font-mono')}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, r) => (
                  <tr key={r} className="border-t border-forest-100 dark:border-white/10">
                    {row.map((value, c) => (
                      <td key={c} className={cn(cellBody, 'font-mono whitespace-nowrap')}>
                        {value === null ? <span className="text-forest-300">null</span> : String(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </div>
      )}
    </div>
  )
}

export default function AdminPanel({ onClose }) {
  const [tab, setTab] = useState('overview')

  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-forest-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="flex h-full w-full flex-col overflow-hidden bg-white shadow-card dark:bg-[#0e1f14] sm:h-[min(88vh,760px)] sm:max-w-5xl sm:rounded-3xl sm:border sm:border-forest-100 sm:dark:border-white/10"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-forest-100 px-4 py-3 dark:border-white/10">
          <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">Admin</span>
          <h2 className="text-lg font-extrabold text-forest-800 dark:text-forest-50">Admin panel</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto grid size-9 place-items-center rounded-full border border-forest-200 bg-white text-forest-600 transition hover:bg-forest-50 dark:border-white/15 dark:bg-white/5 dark:text-forest-200"
          >
            <CloseIcon />
          </button>
        </header>

        <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-forest-100 px-3 py-2 dark:border-white/10">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              className={cn(
                'shrink-0 rounded-xl px-3.5 py-1.5 text-sm font-semibold transition',
                tab === entry.id
                  ? 'bg-forest-600 text-white shadow-sm'
                  : 'text-forest-600 hover:bg-forest-50 dark:text-forest-200 dark:hover:bg-white/10',
              )}
            >
              {entry.label}
            </button>
          ))}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {tab === 'overview' && <OverviewTab />}
          {tab === 'users' && <UsersTab />}
          {tab === 'entries' && <EntriesTab />}
          {tab === 'areas' && <AreasTab />}
          {tab === 'sql' && <SqlTab />}
        </div>
      </motion.div>
    </div>
  )
}
