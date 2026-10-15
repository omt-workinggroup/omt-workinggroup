// Categories, access types and other labels shared by every page.

export const CATEGORIES = {
  'computer-science': { label: 'Computer & Technology', short: 'CS', color: '#3b4cca', icon: 'code', description: 'Programming, computer science and digital skills.' },
  business: { label: 'Business & Entrepreneurship', short: 'BIZ', color: '#8a5a00', icon: 'briefcase', description: 'Management, economics, startups and finance.' },
  'study-skills': { label: 'Study Materials', short: 'STU', color: '#0e7c7b', icon: 'cap', description: 'Study methods, exam preparation and university life.' },
  productivity: { label: 'Productivity', short: 'PRO', color: '#a3367a', icon: 'bolt', description: 'Focus, habits and workplace software skills.' },
  general: { label: 'General Learning', short: 'GEN', color: '#6b4e9b', icon: 'globe', description: 'Literature, philosophy and classic works.' },
  word: { label: 'Microsoft Word', short: 'W', color: '#2b579a', office: true, description: 'Documents, CVs, letters and reports.' },
  excel: { label: 'Microsoft Excel', short: 'X', color: '#217346', office: true, description: 'Formulas, budgets, charts and data.' },
  powerpoint: { label: 'Microsoft PowerPoint', short: 'P', color: '#c43e1c', office: true, description: 'Slide design and presenting.' },
  access: { label: 'Microsoft Access', short: 'A', color: '#a4373a', office: true, description: 'Databases, queries, forms and reports.' },
  outlook: { label: 'Microsoft Outlook', short: 'O', color: '#0f6cbd', office: true, description: 'Email, calendar and communication.' },
  presentations: { label: 'Presentation Templates', short: 'PT', color: '#c2410c', icon: 'slides', description: 'Ready-made decks for school and work.' },
};

export const OFFICE_APPS = ['word', 'excel', 'powerpoint', 'access', 'outlook'];

/** The five access types the platform distinguishes. */
export const ACCESS = {
  omt: {
    label: 'On OMT', badge: 'omt',
    title: 'Available on OMT WORKING GROUP',
    explain: 'Original OMT WORKING GROUP content. Read it here, and download any attached template for free.',
  },
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
};

export const LEVELS = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };

export const categoryLabel = (slug) => CATEGORIES[slug]?.label ?? 'Other';
