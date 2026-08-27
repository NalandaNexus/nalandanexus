/**
 * Development seed script.
 * Populates the database with the Nalanda Nexus course catalog derived
 * from the existing frontend's mock data (courses.js / studentMockData.js),
 * so the frontend's real API calls return the same content it used to get
 * from localStorage - just persisted for real this time.
 *
 * Run: npm run seed
 * Safe to re-run - upserts by stable slug/quizId/taskId instead of duplicating.
 */
import { connectDB, disconnectDB } from '../config/db.js';
import { Course } from '../models/Course.js';
import { Task } from '../models/Task.js';
import { Quiz } from '../models/Quiz.js';
import { User } from '../models/User.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { Message } from '../models/Message.js';
import { Post } from '../models/Post.js';
import { LiveClass } from '../models/LiveClass.js';
import { Announcement } from '../models/Announcement.js';
import { hashPassword } from '../services/auth.service.js';
import { createEnrollment } from '../services/enrollment.service.js';
import { createAnnouncement } from '../services/announcement.service.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

// Known-credential test accounts for manual QA and the multi-student
// isolation tests (master doc section 46) - NOT created in production runs.
const TEST_STUDENTS = [
  { name: 'Aditi Sharma (Test Student A)', email: 'student.a@nalanda.test', password: 'TestPass123!', grade: '9th Standard' },
  { name: 'Rohan Verma (Test Student B)', email: 'student.b@nalanda.test', password: 'TestPass123!', grade: '10th Standard' },
];

const PRARAMBH_MODULES = [
  {
    moduleId: 'mod-1',
    title: 'Module 1: Orientation & Foundations',
    order: 1,
    lessons: [
      { lessonId: 'l-1', title: '1.1 The Awakening: Welcome to Nalanda Nexus', duration: '18 mins', order: 1, videoUrl: '/PRARAMBH.mp4' },
      { lessonId: 'l-2', title: '1.2 Discovering Your Learning Archetype', duration: '24 mins', order: 2, videoUrl: '/PRARAMBH.mp4' },
      { lessonId: 'l-3', title: '1.3 The 3 Pillars: Communicate, Compute, Create', duration: '22 mins', order: 3, videoUrl: '/PRARAMBH.mp4' },
    ],
  },
  {
    moduleId: 'mod-2',
    title: 'Module 2: Mindset & Self Growth',
    order: 2,
    lessons: [
      { lessonId: 'l-4', title: '2.1 Overcoming Self-Doubt & Fear of Failure', duration: '26 mins', order: 1, videoUrl: '/PRARAMBH.mp4' },
      { lessonId: 'l-5', title: '2.2 Developing an Unstoppable Growth Mindset', duration: '30 mins', order: 2, videoUrl: '/PRARAMBH.mp4' },
      { lessonId: 'l-6', title: '2.3 Building Emotional Resilience for High Performance', duration: '28 mins', order: 3, videoUrl: '/PRARAMBH.mp4' },
    ],
  },
  {
    moduleId: 'mod-3',
    title: 'Module 3: Communication Mastery',
    order: 3,
    lessons: [
      { lessonId: 'l-7', title: '3.1 Vocal Presence, Tone & Clarity', duration: '32 mins', order: 1, videoUrl: '/PRARAMBH.mp4' },
      { lessonId: 'l-8', title: '3.2 Storytelling Frameworks for Young Leaders', duration: '35 mins', order: 2, videoUrl: '/PRARAMBH.mp4' },
      { lessonId: 'l-9', title: '3.3 Active Listening & Empathetic Dialogue', duration: '25 mins', order: 3, videoUrl: '/PRARAMBH.mp4' },
    ],
  },
  {
    moduleId: 'mod-4',
    title: 'Module 4: Goal Setting & Productivity',
    order: 4,
    lessons: [
      { lessonId: 'l-10', title: '4.1 Crafting Your 90-Day Vision Blueprint', duration: '28 mins', order: 1, videoUrl: '/PRARAMBH.mp4' },
      { lessonId: 'l-11', title: '4.2 Deep Work Habits for Modern Students', duration: '30 mins', order: 2, videoUrl: '/PRARAMBH.mp4' },
    ],
  },
  {
    moduleId: 'mod-5',
    title: 'Module 5: Real-World Projects & Capstone',
    order: 5,
    lessons: [
      { lessonId: 'l-12', title: '5.1 Project Brainstorming & Problem Definition', duration: '40 mins', order: 1, videoUrl: '/PRARAMBH.mp4', isLocked: true },
      { lessonId: 'l-13', title: '5.2 Capstone Showcase & Peer Evaluation', duration: '45 mins', order: 2, videoUrl: '/PRARAMBH.mp4', isLocked: true },
    ],
  },
];

const UPCOMING_COURSES = [
  { slug: 'python-for-beginners', title: 'Python for Beginners', tagline: 'Start your coding journey with Python.', category: 'programming', pillar: 'compute', difficulty: 'Beginner', duration: '6 Weeks (24 hrs)', bannerImage: '/05_python_learning.png', skills: ['Variables & Loops', 'Object-Oriented Python', 'API Integrations', 'Automation Scripts'], instructor: { name: 'Dr. Vikramaditya Sen', role: 'Principal CS Fellow', avatar: '' } },
  { slug: 'web-development-full-stack', title: 'Web Development Full Stack', tagline: 'Build modern websites and web apps.', category: 'programming', pillar: 'compute', difficulty: 'Intermediate', duration: '10 Weeks (48 hrs)', bannerImage: '/06_web_development.png', skills: ['React 18 & Vite', 'REST & GraphQL APIs', 'Tailwind & UI Engineering', 'Database Design'], instructor: { name: 'Arjun Mehta', role: 'Senior Full-Stack Architect', avatar: '' } },
  { slug: 'data-science-with-python', title: 'Data Science with Python', tagline: 'Learn data analysis, visualization and more.', category: 'data-science', pillar: 'compute', difficulty: 'Intermediate', duration: '8 Weeks (36 hrs)', bannerImage: '/07_data_science.png', skills: ['Pandas & NumPy', 'Statistical Modeling', 'Interactive Dashboards', 'BigQuery SQL'], instructor: { name: 'Pooja Kashyap', role: 'Chief Data Scientist', avatar: '' } },
  { slug: 'ui-ux-design-fundamentals', title: 'UI/UX Design Fundamentals', tagline: 'Design beautiful and user-friendly experiences.', category: 'design', pillar: 'create', difficulty: 'Beginner', duration: '6 Weeks (26 hrs)', bannerImage: '/08_uiux_design.png', skills: ['Figma Mastery', 'User Research & Personas', 'Design Tokens & Systems', 'Micro-animations'], instructor: { name: 'Rhea Nambiar', role: 'Staff Product Designer', avatar: '' } },
  { slug: 'ai-machine-learning-a-z', title: 'AI & Machine Learning A-Z', tagline: 'Build smart models and understand ML concepts.', category: 'ai-ml', pillar: 'compute', difficulty: 'Advanced', duration: '12 Weeks (60 hrs)', bannerImage: '/09_ai_machine_learning.png', skills: ['Neural Networks', 'PyTorch & Transformers', 'Supervised Learning', 'Model Deployment'], instructor: { name: 'Kavita Sundaram', role: 'AI Research Scientist', avatar: '' } },
];

async function seed() {
  await connectDB();
  logger.info('[Seed] Connected. Seeding catalog...');

  const prarambh = await Course.findOneAndUpdate(
    { slug: 'prarambh' },
    {
      slug: 'prarambh',
      title: 'PRARAMBH — The Awakening',
      subtitle: 'Foundation of Future Ready Skills',
      tagline: 'Unlock Your True Potential with Confidence & Communication Mastery.',
      description:
        'Welcome to PRARAMBH – your first step toward mastering confidence and communication. Designed as a 3-month foundation course, this unique program empowers you with essential skills to embrace personal growth and excel in various spheres of life.',
      category: 'foundation',
      pillar: 'communicate',
      grades: ['6', '7', '8', '9', '10', '11', '12'],
      difficulty: 'Beginner Friendly',
      duration: '3 Months',
      bannerImage: '/prarambh_course_banner.jpg',
      videoUrl: '/PRARAMBH.mp4',
      priceInPaise: 500000, // ₹5,000
      originalPriceInPaise: 1200000, // ₹12,000
      currency: 'INR',
      isPurchasable: true,
      isPublished: true,
      // The primary/hero course on the public Landing Page - a real,
      // admin-controllable flag (see Course.js), not hardcoded in any
      // frontend component.
      isFeatured: true,
      isPopular: true,
      instructor: { name: 'Nalanda Nexus Senior Faculty', role: 'Master Mentors & Communication Leaders', avatar: '' },
      skills: ['Confidence Building', 'Communication Mastery', 'Interpersonal Skills', 'Goal Setting', 'Public Speaking & Presentation', 'Mindset & Self Growth'],
      modules: PRARAMBH_MODULES,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  logger.info(`[Seed] Course ready: ${prarambh.slug}`);

  for (const c of UPCOMING_COURSES) {
    await Course.findOneAndUpdate(
      { slug: c.slug },
      {
        ...c,
        priceInPaise: 0,
        isPurchasable: false, // matches frontend catalog: these show "Upcoming", not yet enrollable
        isPublished: true,
        modules: [],
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  logger.info(`[Seed] ${UPCOMING_COURSES.length} upcoming (non-purchasable) catalog courses ready.`);

  const tasksSeed = [
    { taskId: 'orientation-reflection', title: 'Orientation Reflection', type: 'Reflection', moduleTitle: 'Orientation', urgency: 'high', iconName: 'FileText', pointsReward: 30, order: 1, description: 'Reflect on your personal goals and expectations as you embark on the Parambh future-ready journey.' },
    { taskId: 'goal-setting', title: 'Goal Setting Activity', type: 'Task', moduleTitle: 'Goal Setting', urgency: 'medium', iconName: 'Target', pointsReward: 30, order: 2, description: 'Construct a 90-day SMART roadmap balancing communication skills and technical growth.' },
    { taskId: 'skills-exploration', title: 'Skills Exploration', type: 'Task', moduleTitle: 'Skills Discovery', urgency: 'low', iconName: 'Compass', pointsReward: 30, order: 3, description: 'Map your existing strengths across the 3 pillars: Communicate, Compute, and Create.' },
  ];
  for (const t of tasksSeed) {
    await Task.findOneAndUpdate({ taskId: t.taskId }, { ...t, courseId: prarambh._id, isPublished: true }, { upsert: true, new: true, setDefaultsOnInsert: true });
  }
  logger.info(`[Seed] ${tasksSeed.length} tasks ready.`);

  const quizzesSeed = [
    {
      quizId: 'mindset',
      title: 'Mindset & Growth Orientation Quiz',
      moduleTitle: 'Mindset & Self Growth',
      pointsReward: 50,
      timeLimitMins: 10,
      questions: [
        {
          questionId: 'q1',
          question: 'What is the core difference between a Fixed Mindset and a Growth Mindset?',
          options: [
            'Fixed mindset believes skills are unchangeable traits; growth mindset believes abilities can be developed through effort and learning.',
            'Fixed mindset means working on fixed schedules, while growth mindset means studying spontaneously.',
            'Fixed mindset is for science subjects, while growth mindset is for creative subjects.',
            'There is no practical difference between them.',
          ],
          correctIndex: 0,
          explanation: "Dr. Carol Dweck's research demonstrates that growth mindset views challenges as opportunities to expand intelligence.",
        },
        {
          questionId: 'q2',
          question: 'When faced with critical feedback or a setback, what does a growth mindset student do?',
          options: [
            'Defend mistakes and blame external circumstances.',
            'Treat feedback as data to refine strategies and improve future execution.',
            'Avoid similar tasks to prevent future failures.',
            'Ignore mentor comments and proceed unchanged.',
          ],
          correctIndex: 1,
          explanation: 'Constructive feedback provides vital feedback loops that accelerate student mastery.',
        },
        {
          questionId: 'q3',
          question: "What is the psychological power of the word 'YET' in learning?",
          options: [
            'It marks a grammar rule.',
            'It transforms an apparent limitation into a trajectory of future capability.',
            'It avoids committing to any deadline.',
            'It signals completion of the course.',
          ],
          correctIndex: 1,
          explanation: "Adding 'yet' reminds our brain that neuroplasticity enables mastery through deliberate practice.",
        },
        {
          questionId: 'q4',
          question: 'How does consistency impact the student Diya streak?',
          options: [
            'It burns out student energy quickly.',
            'Daily micro-commitments maintain steady momentum and reinforce long-term memory pathways.',
            'Streaks only matter for social rankings.',
            'Streaks have no correlation with learning retention.',
          ],
          correctIndex: 1,
          explanation: 'Regular consistent engagement builds habitual neural connections and compounds knowledge over time.',
        },
      ],
    },
    {
      quizId: 'confidence',
      title: 'Confidence & Communication Foundations',
      moduleTitle: 'Confidence Building',
      pointsReward: 50,
      timeLimitMins: 8,
      questions: [
        {
          questionId: 'q1',
          question: 'What is the most effective initial step to overcome stage fright before speaking?',
          options: [
            'Speaking as quickly as possible to get it over with.',
            'Box breathing (4-4-4-4) to regulate the autonomic nervous system and grounding your stance.',
            'Avoiding eye contact with the audience.',
            'Memorizing every single word without understanding the narrative structure.',
          ],
          correctIndex: 1,
          explanation: 'Regulated breathing activates the parasympathetic nervous system, lowering heart rate and steadying vocal cords.',
        },
        {
          questionId: 'q2',
          question: 'In speech delivery, what does vocal inflection communicate?',
          options: ['Volume only.', 'Nuance, conviction, emotional resonance, and key emphasis in your ideas.', 'Speech speed only.', 'Accidental pauses.'],
          correctIndex: 1,
          explanation: 'Dynamic vocal inflection keeps listeners engaged and highlights the hierarchy of your arguments.',
        },
      ],
    },
  ];
  for (const q of quizzesSeed) {
    await Quiz.findOneAndUpdate({ quizId: q.quizId }, { ...q, courseId: prarambh._id, isPublished: true }, { upsert: true, new: true, setDefaultsOnInsert: true });
  }
  logger.info(`[Seed] ${quizzesSeed.length} quizzes ready.`);

  if (env.nodeEnv === 'production') {
    logger.info('[Seed] Skipping test accounts/demo content in production.');
  } else {
    const testUsers = [];
    for (const s of TEST_STUDENTS) {
      let user = await User.findOne({ email: s.email });
      if (!user) {
        const passwordHash = await hashPassword(s.password);
        user = await User.create({ name: s.name, email: s.email, passwordHash, role: 'student', isVerified: true });
        await StudentProfile.create({ userId: user._id, grade: s.grade });
        logger.info(`[Seed] Test account created: ${s.email} / ${s.password}`);
      }
      await createEnrollment({ userId: user._id, courseId: prarambh._id, course: prarambh });
      await Message.findOneAndUpdate(
        { userId: user._id, sender: 'teacher' },
        {
          userId: user._id,
          sender: 'teacher',
          body: `Welcome to Nalanda Nexus, ${s.name.split(' ')[0]}! Reach out here anytime you have a question about the course.`,
        },
        { upsert: true, setDefaultsOnInsert: true }
      );
      testUsers.push(user);
    }
    logger.info(`[Seed] ${TEST_STUDENTS.length} test student accounts ready (enrolled + welcome message).`);

    // Known-credential admin account so the /api/admin content-authoring
    // endpoints (announcements, live classes) are actually reachable without
    // hand-editing the database - there is no self-service admin signup by
    // design (registerStudent always creates role: 'student').
    let adminUser = await User.findOne({ email: 'admin@nalanda.test' });
    if (!adminUser) {
      const passwordHash = await hashPassword('AdminPass123!');
      adminUser = await User.create({
        name: 'Nalanda Admin (Test)',
        email: 'admin@nalanda.test',
        passwordHash,
        role: 'admin',
        isVerified: true,
      });
      logger.info('[Seed] Test admin account created: admin@nalanda.test / AdminPass123!');
    }

    const liveClassesSeed = [
      { title: 'PRARAMBH Live Q&A: Confidence & Communication', instructor: 'Nalanda Nexus Senior Faculty', scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), durationMinutes: 60, joinUrl: 'https://meet.example.com/prarambh-live-qna', status: 'upcoming' },
      { title: 'Goal Setting Workshop', instructor: 'Nalanda Nexus Senior Faculty', scheduledAt: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000), durationMinutes: 45, joinUrl: 'https://meet.example.com/prarambh-goal-workshop', status: 'upcoming' },
      { title: 'Orientation Session (Recording)', instructor: 'Nalanda Nexus Senior Faculty', scheduledAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), durationMinutes: 50, recordingUrl: '/PRARAMBH.mp4', status: 'completed' },
    ];
    for (const lc of liveClassesSeed) {
      await LiveClass.findOneAndUpdate(
        { title: lc.title, courseId: prarambh._id },
        { ...lc, courseId: prarambh._id, isPublished: true },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    logger.info(`[Seed] ${liveClassesSeed.length} live classes ready.`);

    if ((await Announcement.countDocuments({})) === 0) {
      await createAnnouncement({
        title: 'Welcome to Nalanda Nexus!',
        content: 'Your PRARAMBH journey starts now. Complete Module 1 this week to earn your first streak badge.',
        type: 'general',
        createdBy: adminUser._id,
      });
      await createAnnouncement({
        title: 'New: Live Q&A sessions',
        content: 'Check the Live Classes page for upcoming mentor-led sessions and recordings from past sessions.',
        type: 'course',
        createdBy: adminUser._id,
      });
      logger.info('[Seed] 2 announcements ready.');
    }

    if (testUsers.length && (await Post.countDocuments({})) === 0) {
      await Post.create({ userId: testUsers[0]._id, body: 'Just finished Module 1 of PRARAMBH — the vocal presence lesson was a game changer for my school presentations!' });
      await Post.create({ userId: testUsers[1]._id, body: 'Setting my 90-day goals today. Anyone else working through the Goal Setting Activity?' });
      logger.info('[Seed] 2 community posts ready.');
    }
  }

  logger.info('[Seed] Done.');
  await disconnectDB();
  process.exit(0);
}

seed().catch((err) => {
  logger.error('[Seed] Failed', err);
  process.exit(1);
});
