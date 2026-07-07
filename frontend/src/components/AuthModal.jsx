import { useState } from 'react'
import { motion } from 'motion/react'
import { useAuth } from '../AuthContext'
import { useI18n } from '../i18n'
import { BrandMark } from '../icons'
import { Particles } from '../ui/particles'
import { ShimmerButton } from '../ui/shimmer-button'
import { fieldInput, labelText, btnGhost } from '../ui/form'

export default function AuthModal({ mode: initialMode, onClose }) {
  const { login, register } = useAuth()
  const { t } = useI18n()
  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, username, password)
      }
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-forest-900/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={(event) => event.stopPropagation()}
        className="beam-border relative w-[min(400px,94vw)] overflow-hidden rounded-3xl border border-forest-100 bg-white p-7 shadow-card dark:border-white/10 dark:bg-[#12241a]"
      >
        <Particles className="absolute inset-0 h-full w-full" quantity={45} color="#2e7d32" />
        <div className="relative">
          <div className="mb-4 flex items-center gap-2">
            <span className="grid size-10 place-items-center rounded-2xl bg-forest-600 shadow-glow">
              <BrandMark size={24} />
            </span>
            <h2 className="text-xl font-extrabold text-forest-800 dark:text-forest-50">
              {mode === 'login' ? t('logInTitle') : t('createAccount')}
            </h2>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className={labelText}>
              {t('email')}
              <input
                type="email"
                className={fieldInput}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoFocus
              />
            </label>
            {mode === 'register' && (
              <label className={labelText}>
                {t('username')}
                <input
                  className={fieldInput}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  minLength={3}
                  maxLength={80}
                  required
                />
              </label>
            )}
            <label className={labelText}>
              {t('password')}
              <input
                type="password"
                className={fieldInput}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />
            </label>
            {error && <p className="text-sm font-medium text-red-600">{error}</p>}
            <div className="mt-1 flex gap-2">
              <ShimmerButton type="submit" disabled={busy} className="flex-1">
                {busy ? t('pleaseWait') : mode === 'login' ? t('logIn') : t('register')}
              </ShimmerButton>
              <button type="button" className={btnGhost} onClick={onClose}>
                {t('cancel')}
              </button>
            </div>
          </form>
          <p className="mt-4 text-sm text-forest-600 dark:text-forest-300">
            {mode === 'login' ? (
              <>
                {t('noAccount')}{' '}
                <button
                  type="button"
                  className="font-semibold text-forest-700 underline dark:text-forest-200"
                  onClick={() => setMode('register')}
                >
                  {t('register')}
                </button>
              </>
            ) : (
              <>
                {t('alreadyRegistered')}{' '}
                <button
                  type="button"
                  className="font-semibold text-forest-700 underline dark:text-forest-200"
                  onClick={() => setMode('login')}
                >
                  {t('logIn')}
                </button>
              </>
            )}
          </p>
        </div>
      </motion.div>
    </div>
  )
}
