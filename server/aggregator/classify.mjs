// Puts an imported book on the right OMT shelf: one library category (the shelves in js/core/taxonomy.js),
// any number of finer subjects, a difficulty level and a content type. Returns null for books outside
// OMT's technology and STEM scope, so the importer skips them.

// Finer subjects (a book can have several). Order matters only for readability.
const SUBJECTS = [
  ['Software Engineering', /software engineering|software design|design patterns|agile|requirements engineering|software process/],
  ['Software Testing and Quality Assurance', /software testing|unit test|test-driven|quality assurance/],
  ['Programming Languages', /\b(python|java|javascript|typescript|c\+\+|c#|rust|go programming|haskell|ruby|php|kotlin|swift|scala|lisp|prolog|fortran|matlab|r programming)\b|programming language/],
  ['Web Development', /web development|html|css|web design|front-?end|back-?end|web application|php|node\.?js|react/],
  ['Mobile App Development', /mobile app|android|ios development|app development/],
  ['Artificial Intelligence', /artificial intelligence|\bai\b|intelligent systems|expert system/],
  ['Machine Learning', /machine learning|deep learning|neural network|reinforcement learning/],
  ['Data Science', /data science|statistic|data analysis|data analytics|big data|data mining|visuali[sz]ation/],
  ['Cybersecurity', /cyber ?security|information security|network security|cryptograph|ethical hacking|hack(er|ers|ing)\b|malware|privacy/],
  ['Ethical Computing and Security Fundamentals', /computer ethics|ethics in computing|digital ethics|responsible computing/],
  ['Computer Networking', /network|tcp\/ip|internet protocol|routing|switching|wireless lan/],
  ['Cloud Computing', /cloud computing|\baws\b|azure|virtuali[sz]ation/],
  ['DevOps', /devops|continuous integration|kubernetes|docker|site reliability/],
  ['Linux and Operating Systems', /linux|unix|operating system|command line|shell script/],
  ['Database Management', /database|\bsql\b|relational|nosql|data modeling/],
  ['Information Systems', /information systems?|management information|enterprise systems|business informatics/],
  ['Computer Architecture', /computer architecture|computer organi[sz]ation|digital logic|microprocessor|assembly language|embedded system/],
  ['UI/UX Design', /user experience|\bux\b|user interface|interaction design|usability/],
  ['Human-Computer Interaction', /human[- ]computer interaction|\bhci\b/],
  ['Telecommunications', /telecommunication|signal processing|communication systems|5g|lte|radio|antenna|wireless/],
  ['Internet of Things', /internet of things|\biot\b|sensor network/],
  ['Robotics', /robot|mechatronic|control systems?/],
  ['Mathematics for Computing', /discrete math|linear algebra|calculus|algebra|probability|number theory|graph theory|mathematic|geometry|trigonometr|differential equation/],
  ['Electronics', /electronics?\b(?! frontier)|circuit|semiconductor|electrical engineering|electromagnet|electricity/],
  ['Engineering', /engineering|mechanics|thermodynamic|materials science|fluid|statics|dynamics/],
  ['Computer Science', /computer science|\bcomputers?\b|algorithm|data structure|computation|compiler|programming|coding|software/],
  ['Digital Technology', /digital literacy|digital technology|computer applications|information technology/],
  ['IT Fundamentals', /it fundamentals|computer basics|introduction to computers|computer literacy|it support|help ?desk/],
  ['Physics', /physics|astronomy|optics|quantum/],
  ['Chemistry', /chemistry|biochemistry/],
];

// Subject -> library category, first match wins (most specific first).
const CATEGORY_OF = [
  ['Cybersecurity', 'security'], ['Ethical Computing and Security Fundamentals', 'security'],
  ['Machine Learning', 'data-ai'], ['Artificial Intelligence', 'data-ai'], ['Data Science', 'data-ai'], ['Database Management', 'data-ai'],
  ['Cloud Computing', 'cloud'], ['DevOps', 'cloud'],
  ['Linux and Operating Systems', 'linux'],
  ['Telecommunications', 'telecom'], ['Internet of Things', 'telecom'],
  ['Computer Networking', 'networking'],
  ['UI/UX Design', 'design'], ['Human-Computer Interaction', 'design'],
  ['Software Engineering', 'computer-science'], ['Software Testing and Quality Assurance', 'computer-science'], ['Programming Languages', 'computer-science'],
  ['Web Development', 'computer-science'], ['Mobile App Development', 'computer-science'], ['Computer Architecture', 'computer-science'],
  ['Information Systems', 'computer-science'], ['Computer Science', 'computer-science'], ['Digital Technology', 'computer-science'], ['IT Fundamentals', 'computer-science'],
  ['Robotics', 'engineering'], ['Electronics', 'engineering'], ['Engineering', 'engineering'],
  ['Mathematics for Computing', 'maths'],
  ['Physics', 'science'], ['Chemistry', 'science'],
];

const strip = (s) => String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ');

export function classify({ title = '', description = '', subjects = [], hint = '' }) {
  // Title and the source's own subjects count more than the description, which can mention anything.
  const strong = ` ${strip(title)} ${subjects.join(' ')} ${hint} `.toLowerCase();
  const weak = ` ${strip(description)} `.toLowerCase();
  const found = SUBJECTS.filter(([, re]) => re.test(strong)).map(([name]) => name);
  if (!found.length) {
    // Fall back to the description, but only for clearly technical wording.
    for (const [name, re] of SUBJECTS) if (re.test(weak) && name !== 'Engineering' && name !== 'Computer Science') found.push(name);
  }
  if (!found.length) return null;
  const category = CATEGORY_OF.find(([subject]) => found.includes(subject))?.[1];
  if (!category) return null;
  const text = `${strong} ${weak}`;
  const level = /\b(advanced|graduate|research|theory of|in depth)\b/.test(text) ? 'advanced'
    : /\b(introduct|beginner|fundamental|basics|first course|for everyone|getting started|elementary|primer)/.test(text) ? 'beginner' : 'intermediate';
  return { category, subjects: [...new Set(found)].slice(0, 6), level };
}

/** Content type shown on the book page. */
export function contentType({ title = '', hint = '' }) {
  const t = `${title} ${hint}`.toLowerCase();
  if (/course|lecture|module|syllabus/.test(t)) return 'Course materials';
  if (/guide|handbook|manual|cookbook/.test(t)) return 'Study guide';
  if (/tutorial|hands-on|practical|lab/.test(t)) return 'Practical tutorial';
  if (/reference/.test(t)) return 'Technical reference';
  if (/research|proceedings|monograph/.test(t)) return 'Research book';
  return 'Textbook';
}
