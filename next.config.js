/** @type {import("next").NextConfig} */
const nextConfig = {
  typescript: {
    // Windows/sandbox ortamlarda Next'in typecheck worker spawn'ı EPERM hatası verebiliyor.
    // Tip kontrolünü CI/komut satırında `npx tsc --noEmit` ile ayrı çalıştırıyoruz.
    ignoreBuildErrors: true,
  },
  experimental: {
    // Build worker'larını process spawn yerine worker_threads ile çalıştırmayı dener.
    workerThreads: true,
  },
  turbopack: {
    // Turbopack yanlışlıkla üst dizindeki lockfile'ı "root" seçebiliyor.
    // Bu ayar ile proje kökünü sabitliyoruz.
    root: __dirname,
  },
};

module.exports = nextConfig;
