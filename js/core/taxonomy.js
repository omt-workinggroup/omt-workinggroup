// Categories, access types and other labels shared by every page.

export const CATEGORIES = {
  'computer-science': { label: 'Programming & Software', short: 'DEV', color: '#3b4cca', icon: 'code', tech: true, description: 'Coding, computer science, Git and software engineering.' },
  networking: { label: 'Networking', short: 'NET', color: '#0b6e99', icon: 'network', tech: true, description: 'TCP/IP, routing, switching, subnetting and protocols.' },
  telecom: { label: 'Telecom & Wireless', short: 'TEL', color: '#7c3aed', icon: 'antenna', tech: true, description: '4G, 5G, RF, fibre and telecom standards.' },
  cloud: { label: 'Cloud & DevOps', short: 'OPS', color: '#0e7490', icon: 'cloud', tech: true, description: 'Containers, Kubernetes, CI/CD and site reliability.' },
  security: { label: 'Cybersecurity', short: 'SEC', color: '#b42318', icon: 'shield', tech: true, description: 'Secure coding, threats, frameworks and defence.' },
  'data-ai': { label: 'Data & AI', short: 'AI', color: '#9d174d', icon: 'chip', tech: true, description: 'Data science, SQL, machine learning and deep learning.' },
  linux: { label: 'Linux & Systems', short: 'SYS', color: '#374151', icon: 'terminal', tech: true, description: 'The command line, operating systems and administration.' },
  business: { label: 'Business & Entrepreneurship', short: 'BIZ', color: '#8a5a00', icon: 'briefcase', description: 'Management, economics, startups and finance.' },
  'study-skills': { label: 'Study Materials', short: 'STU', color: '#0e7c7b', icon: 'cap', description: 'Study methods, exam preparation and university life.' },
  productivity: { label: 'Productivity', short: 'PRO', color: '#a3367a', icon: 'bolt', description: 'Focus, habits and workplace software skills.' },
  design: { label: 'Design & Canva', short: 'DSN', color: '#00a3b4', icon: 'slides', description: 'Canva, layout, typography, colour and branding.' },
  success: { label: 'Success & Mindset', short: 'WIN', color: '#b7791f', icon: 'bolt', description: 'Habits, mindset, money and the classics on getting ahead.' },
  general: { label: 'General Learning', short: 'GEN', color: '#6b4e9b', icon: 'globe', description: 'Literature, philosophy and classic works.' },
  word: { label: 'Microsoft Word', short: 'W', color: '#2b579a', office: true, description: 'Documents, CVs, letters and reports.' },
  excel: { label: 'Microsoft Excel', short: 'X', color: '#217346', office: true, description: 'Formulas, budgets, charts and data.' },
  powerpoint: { label: 'Microsoft PowerPoint', short: 'P', color: '#c43e1c', office: true, description: 'Slide design and presenting.' },
  access: { label: 'Microsoft Access', short: 'A', color: '#a4373a', office: true, description: 'Databases, queries, forms and reports.' },
  outlook: { label: 'Microsoft Outlook', short: 'O', color: '#0f6cbd', office: true, description: 'Email, calendar and communication.' },
  presentations: { label: 'Presentations & Public Speaking', short: 'PT', color: '#c2410c', icon: 'slides', description: 'Slide design, public speaking, storytelling and ready-made decks.' },
};

/** Tech categories, in the order they are shown. */
export const TECH = Object.keys(CATEGORIES).filter((k) => CATEGORIES[k].tech);

export const OFFICE_APPS = ['word', 'excel', 'powerpoint', 'access', 'outlook'];

/** The five access types the platform distinguishes. */
export const ACCESS = {
  open: {
    label: 'Free & open', badge: 'open',
    title: 'Free: public domain or openly licensed',
    explain: 'Free to read from the official source because it is in the public domain or under an open licence.',
  },
  official: {
    label: 'Official source', badge: 'official',
    title: 'Free on the official provider\'s website',
    explain: 'Free to use on the publisher\'s or provider\'s own website. OMT links to it and does not host a copy.',
  },
  preview: {
    label: 'Preview', badge: 'official',
    title: 'Free preview on Google Books',
    explain: 'Read a free sample of this book on Google Books. Buy it or borrow it from a library for the full text.',
  },
  paid: {
    label: 'Buy or borrow', badge: 'paid',
    title: 'In copyright: buy it or borrow it from a library',
    explain: 'This book is in copyright, so OMT does not provide the text. Find an edition to buy, or borrow it through a library or Open Library\'s lending programme.',
  },
  info: {
    label: 'Info only', badge: 'info',
    title: 'Description only',
    explain: 'We can describe this resource, but we do not know of a legal free copy.',
  },
};

export const KINDS = {
  book: 'Book',
  guide: 'Guide',
  template: 'Template',
  tutorial: 'Tutorial',
  course: 'Course',
  standard: 'Standard',
};

export const LEVELS = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };

export const categoryLabel = (slug) => CATEGORIES[slug]?.label ?? 'Other';
