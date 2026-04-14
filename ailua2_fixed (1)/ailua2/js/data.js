const BASE_IMG = 'assets/img';

const PROJECTS = {
  webapp: {
    num: '01',
    headline: 'ailua. — Web App\n& Full-Stack Solutions',
    body: 'Kami membangun web application yang cepat, scalable, dan siap produksi. Dari arsitektur backend hingga UI yang mulus.',
    body2: 'Setiap proyek dikerjakan dengan stack modern dan pendekatan component-driven, memastikan kode yang bersih, maintainable, dan mudah dikembangkan.',
    cta: 'AILUA.SCR',
    year: '2023–2025',
    color: '#E8FF47',
    strip: {
      cat: 'Web & Mobile',
      about: 'Kami merancang dan membangun web application modern dengan performa tinggi, arsitektur scalable, dan pengalaman pengguna yang mulus dari end-to-end.',
      detail: 'Setiap proyek dibangun dengan stack terkini — React, Next.js, dan Node.js — menggunakan pendekatan component-driven untuk kode yang bersih dan mudah dikembangkan.',
    },
    concepts: [
      {
        name: 'Project Alpha',
        desc: 'Dashboard analytics real-time dengan integrasi API third-party dan sistem notifikasi live.',
        images: [
          BASE_IMG + '/webapp/project-alpha/1.jpg',
          BASE_IMG + '/webapp/project-alpha/2.jpg',
          BASE_IMG + '/webapp/project-alpha/3.jpg',
        ]
      },
      {
        name: 'Dashboard Pro',
        desc: 'Platform SaaS multi-tenant dengan role management, billing, dan modul laporan otomatis.',
        images: [
          BASE_IMG + '/webapp/dashboard-pro/1.jpg',
          BASE_IMG + '/webapp/dashboard-pro/2.jpg',
        ]
      },
      {
        name: 'Code Studio',
        desc: 'Web IDE kolaboratif dengan fitur live preview, version control, dan deploy ke cloud.',
        images: [
          BASE_IMG + '/webapp/code-studio/1.jpg',
          BASE_IMG + '/webapp/code-studio/2.jpg',
        ]
      },
    ]
  },

  portfolio: {
    num: '02',
    headline: 'ailua. — Portfolio\n& Personal Branding',
    body: 'Portfolio bukan sekadar CV online — tapi sebuah statement. Kami merancang website personal yang merepresentasikan identitas dan karya dengan presisi.',
    body2: 'Setiap detail tipografi, motion, dan layout dipilih secara cermat agar klien tampil profesional dan berkesan di mata audiens mereka.',
    cta: 'AILUA.SCR',
    year: '2023–2025',
    color: '#3DFFD4',
    strip: {
      cat: 'Design & Dev',
      about: 'Portfolio bukan sekadar CV online. Kami merancang website personal yang merepresentasikan identitas, kepribadian, dan karya terbaik klien dengan presisi visual.',
      detail: 'Setiap elemen — dari tipografi hingga motion — dipilih cermat agar klien tampil profesional dan berkesan kuat di mata audiens serta calon klien mereka.',
    },
    concepts: [
      {
        name: 'Studio Bento',
        desc: 'Portfolio fotografer dengan lightbox gallery, lazy load, dan CMS headless untuk update mandiri.',
        images: [
          BASE_IMG + '/portfolio/studio-bento/1.jpg',
          BASE_IMG + '/portfolio/studio-bento/2.jpg',
          BASE_IMG + '/portfolio/studio-bento/3.jpg',
        ]
      },
      {
        name: 'Forma Personal',
        desc: 'Personal branding site untuk UX designer dengan animasi scroll-driven dan studi kasus interaktif.',
        images: [
          BASE_IMG + '/portfolio/forma-personal/1.jpg',
          BASE_IMG + '/portfolio/forma-personal/2.jpg',
        ]
      },
      {
        name: 'Grid Studio',
        desc: 'Portfolio agensi kreatif dengan grid masonry dinamis dan filterable project categories.',
        images: [
          BASE_IMG + '/portfolio/grid-studio/1.jpg',
          BASE_IMG + '/portfolio/grid-studio/2.jpg',
        ]
      },
    ]
  },

  ui: {
    num: '03',
    headline: 'ailua. — UI Dev\n& Design Systems',
    body: 'Dari Figma ke kode yang bersih dan terstruktur. Kami mengubah design file menjadi komponen interaktif yang konsisten di semua breakpoint.',
    body2: 'Kami membangun design system yang skalabel — dari token hingga dokumentasi Storybook — sehingga tim produk bisa bergerak lebih cepat.',
    cta: 'AILUA.SCR',
    year: '2023–2025',
    color: '#FFB5E8',
    strip: {
      cat: 'UI & UX',
      about: 'Dari file Figma ke kode terstruktur. Kami membangun komponen interaktif, design system yang konsisten, dan antarmuka yang bekerja sempurna di semua perangkat.',
      detail: 'Kami mengembangkan design system skalabel — dari token hingga dokumentasi Storybook — agar tim produk dapat bergerak lebih cepat dan lebih efisien.',
    },
    concepts: [
      {
        name: 'Pulse UI',
        desc: 'Design system lengkap untuk startup fintech: 80+ komponen, dark mode, dan aksesibilitas WCAG AA.',
        images: [
          BASE_IMG + '/ui/pulse-ui/1.jpg',
          BASE_IMG + '/ui/pulse-ui/2.jpg',
          BASE_IMG + '/ui/pulse-ui/3.jpg',
        ]
      },
      {
        name: 'Forma Interface',
        desc: 'Redesign aplikasi mobile dengan pendekatan atomic design dan micro-animation Framer Motion.',
        images: [
          BASE_IMG + '/ui/forma-interface/1.jpg',
          BASE_IMG + '/ui/forma-interface/2.jpg',
        ]
      },
      {
        name: 'Motion Kit',
        desc: 'Library animasi UI siap pakai untuk React — transisi halaman, skeleton loader, dan gesture handler.',
        images: [
          BASE_IMG + '/ui/motion-kit/1.jpg',
          BASE_IMG + '/ui/motion-kit/2.jpg',
        ]
      },
    ]
  }
};
