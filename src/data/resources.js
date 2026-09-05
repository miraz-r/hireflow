export const CATEGORIES = [
  'All',
  'Career Advice',
  'Job Search',
  'Interviews',
  'Salary & Compensation',
  'Company Research',
  'Job Market',
  'Career Growth',
];

export const RESOURCES = [
  {
    slug: 'how-to-choose-the-right-role',
    category: 'Career Advice',
    size: 'large',
    visual: 'gradient-indigo',
    icon: 'compass',
    image: '/resources/career-choose-role.jpg',
    title: 'How to Choose the Right Role for Your Career',
    description:
      'A practical framework for evaluating roles, companies, compensation packages, and growth trajectories \u2014 so you make decisions you will not regret.',
    content: {
      intro:
        'Choosing the right role is one of the most consequential career decisions you will make. A thoughtful approach helps you avoid common pitfalls and positions you for long-term satisfaction.',
      sections: [
        {
          heading: 'Clarify What Matters Most to You',
          body: 'Before browsing job boards, take time to identify your core priorities. Consider factors like work-life balance, compensation, learning opportunities, team culture, and alignment with your long-term career goals. Different roles will emphasize different aspects, so knowing your hierarchy of needs helps you evaluate trade-offs.',
        },
        {
          heading: 'Evaluate the Role Beyond the Title',
          body: 'Job titles can be misleading. Look at the actual responsibilities, the team structure, and how the role fits into the broader organization. Ask questions about decision-making authority, growth potential, and what success looks like in the first six months.',
        },
        {
          heading: 'Research the Company Thoroughly',
          body: 'A great role at the wrong company can quickly become a poor experience. Investigate the company\u2019s financial health, leadership team, market position, and employee reviews. Look for patterns in how the company treats its people and whether its stated values match its actions.',
        },
        {
          heading: 'Consider the Compensation Package Holistically',
          body: 'Base salary is just one piece of the puzzle. Evaluate equity, bonuses, benefits, retirement contributions, professional development budgets, and flexibility. A slightly lower salary with strong equity upside or excellent benefits may be the better long-term choice.',
        },
        {
          heading: 'Think Three Steps Ahead',
          body: 'Consider where this role will take you in two to five years. Does it build skills you want to develop? Does it open doors to the next role you are targeting? The best career moves are strategic, not just reactive to the immediate opportunity.',
        },
      ],
    },
  },
  {
    slug: 'negotiating-your-first-offer',
    category: 'Salary & Compensation',
    size: 'medium',
    visual: 'dark',
    icon: null,
    image: '/resources/salary-negotiate.jpg',
    title: 'Negotiating Your First Offer with Confidence',
    description:
      'Step-by-step guidance on evaluating compensation packages and having the conversation.',
    content: {
      intro:
        'Negotiating a job offer can feel daunting, especially early in your career. But most employers expect it, and a thoughtful negotiation demonstrates professionalism and self-awareness.',
      sections: [
        {
          heading: 'Understand the Full Picture',
          body: 'Before negotiating, make sure you understand the complete compensation package. This includes base salary, signing bonus, annual bonus structure, equity or stock options, health insurance, retirement plans, PTO policy, and any other perks. Research market rates for the role using sites like Glassdoor, Levels.fyi, and Payscale.',
        },
        {
          heading: 'Prepare Your Case',
          body: 'Build a clear rationale for your request. Focus on the value you bring: relevant skills, experience, certifications, and market data. Avoid making it personal. Instead of "I need more because my rent went up," frame it as "Based on market data and my experience level, I believe X is a fair range."',
        },
        {
          heading: 'Timing and Delivery',
          body: 'The best time to negotiate is after you have received a written offer but before you sign. Express enthusiasm for the role first, then discuss compensation. A phone call or video conversation is often more effective than email for reaching a collaborative agreement.',
        },
        {
          heading: 'Know Your Walk-Away Number',
          body: 'Before entering the conversation, decide the minimum package you would accept. This gives you clarity and confidence. If the offer cannot reach your threshold, you need to be prepared to decline gracefully while maintaining the relationship.',
        },
        {
          heading: 'Get It in Writing',
          body: 'Once you reach an agreement, request an updated offer letter that reflects the negotiated terms. Verbal promises can be forgotten or misremembered. A written confirmation protects both you and the employer.',
        },
      ],
    },
  },
  {
    slug: 'acing-the-behavioral-interview',
    category: 'Interviews',
    size: 'medium',
    visual: 'gradient-violet',
    icon: 'mic',
    image: '/resources/interview-behavioral.jpg',
    title: 'Acing the Behavioral Interview',
    description:
      'Use the STAR method to tell compelling stories about your experience.',
    content: {
      intro:
        'Behavioral interviews assess how you have handled real situations in the past. Your ability to tell clear, structured stories is one of the most reliable predictors of interview success.',
      sections: [
        {
          heading: 'Master the STAR Framework',
          body: 'STAR stands for Situation, Task, Action, Result. For each story, briefly set the context (Situation), explain what was required of you (Task), describe the specific steps you took (Action), and share the outcome (Result). This structure keeps your answers focused and memorable.',
        },
        {
          heading: 'Build a Story Bank',
          body: 'Prepare eight to ten stories from your experience that demonstrate key competencies: leadership, teamwork, problem-solving, conflict resolution, adaptability, and initiative. Each story should be adaptable to multiple question types. Practice telling them in two to three minutes.',
        },
        {
          heading: 'Be Specific and Honest',
          body: 'Interviewers can spot rehearsed or exaggerated answers. Use real examples with concrete details. It is fine to say "I made a mistake" if you can explain what you learned. Authenticity builds trust and makes your stories more compelling.',
        },
        {
          heading: 'Quantify When Possible',
          body: 'Numbers make your impact tangible. Instead of "I improved the process," say "I reduced the processing time by 30 percent" or "I increased customer satisfaction scores from 72 to 89." Even rough numbers add credibility.',
        },
        {
          heading: 'Practice Active Listening',
          body: 'Pay careful attention to the actual question being asked. It is acceptable to take a brief pause to think before answering. If a story does not fit the question, do not force it. Ask for clarification if needed.',
        },
      ],
    },
  },
  {
    slug: 'rise-of-skills-based-hiring',
    category: 'Job Market',
    size: 'wide',
    visual: 'pattern',
    icon: null,
    image: '/resources/job-market-skills.jpg',
    title: 'The Rise of Skills-Based Hiring',
    description:
      'Why more companies are dropping degree requirements and how it changes the talent landscape.',
    content: {
      intro:
        'A growing number of employers are shifting from credential-based hiring to skills-based hiring. This trend is reshaping how candidates are evaluated and how companies build their teams.',
      sections: [
        {
          heading: 'What Skills-Based Hiring Means',
          body: 'Skills-based hiring focuses on a candidate\u2019s actual abilities rather than their educational background or previous job titles. Companies assess skills through work samples, technical assessments, portfolio reviews, and structured interviews. The goal is to evaluate what you can do, not where you studied.',
        },
        {
          heading: 'Why Companies Are Making the Shift',
          body: 'Tight labor markets have pushed companies to broaden their talent pools. Research shows that many successful professionals lack traditional degrees. By removing degree requirements, companies access a larger, more diverse candidate pool and often find excellent performers who were previously overlooked.',
        },
        {
          heading: 'How to Position Yourself',
          body: 'Build a portfolio that demonstrates your skills directly. Contribute to open-source projects, complete relevant certifications, create case studies from past work, and maintain an up-to-date LinkedIn profile that highlights specific competencies rather than just job titles.',
        },
        {
          heading: 'The Role of Assessments',
          body: 'Many companies now use skills assessments as part of their hiring process. These might include coding challenges, design exercises, writing tests, or case study presentations. Treat these as opportunities to showcase your abilities, not as obstacles.',
        },
        {
          heading: 'What This Means for Your Career',
          body: 'The shift toward skills-based hiring benefits continuous learners. Invest in developing transferable skills, stay current with industry tools, and document your growth. Your ability to demonstrate competence will matter more than your pedigree.',
        },
      ],
    },
  },
  {
    slug: 'questions-before-accepting-an-offer',
    category: 'Company Research',
    size: 'small',
    visual: 'emerald',
    icon: null,
    image: '/resources/company-questions.jpg',
    title: 'Questions to Ask Before Accepting an Offer',
    description: 'What to uncover about culture, growth, and stability.',
    content: {
      intro:
        'An offer letter tells you about compensation, but the questions you ask reveal the real picture. Before accepting, gather the information that matters most for your success and satisfaction.',
      sections: [
        {
          heading: 'Team and Culture',
          body: 'Ask about the team structure, reporting relationships, and how decisions are made. Questions like "How would you describe the team\u2019s working style?" and "What does a typical day look like in this role?" give you insight into the actual experience beyond the job description.',
        },
        {
          heading: 'Growth and Development',
          body: 'Inquire about learning opportunities, mentorship, career paths, and promotion timelines. A company that invests in its people signals long-term thinking. Ask "How have people in this role grown?" and "What does professional development look like here?"',
        },
        {
          heading: 'Performance and Expectations',
          body: 'Understanding how success is measured helps you prepare. Ask about key performance indicators, review processes, and what the first 90 days typically look like. This also signals to the employer that you are results-oriented.',
        },
        {
          heading: 'Company Stability and Direction',
          body: 'Ask about the company\u2019s growth plans, recent funding, market position, and strategic priorities. While you may not get detailed financial information, the way leadership answers these questions reveals a lot about the company\u2019s trajectory.',
        },
        {
          heading: 'The Real Reason the Role Is Open',
          body: 'Is this a new position or a replacement? If it is a replacement, understanding why the previous person left can reveal important truths about the role and the organization. This is a direct question that thoughtful employers will respect.',
        },
      ],
    },
  },
  {
    slug: 'when-to-make-a-career-pivot',
    category: 'Career Growth',
    size: 'tall',
    visual: 'gradient-warm',
    icon: 'trending',
    image: '/resources/career-pivot.jpg',
    title: 'When to Make a Career Pivot',
    description:
      'Signs it is time for a change, how to transfer skills between industries, and building credibility in a new field.',
    content: {
      intro:
        'A career pivot is not a sign of failure. It is a strategic move that, when done thoughtfully, can lead to greater fulfillment, better compensation, and renewed professional energy.',
      sections: [
        {
          heading: 'Recognize the Signs',
          body: 'Common indicators include persistent boredom, Sunday-night dread, feeling over-qualified for your tasks, or watching your industry contract. If you have been considering a change for more than six months and have explored fixes within your current role, it may be time to act.',
        },
        {
          heading: 'Audit Your Transferable Skills',
          body: 'Most skills transfer more broadly than you think. Project management, communication, data analysis, leadership, and problem-solving are valuable across industries. Map your existing skills to the requirements of your target field to identify gaps and strengths.',
        },
        {
          heading: 'Build Credibility Before You Leap',
          body: 'Take on side projects, complete certifications, volunteer, or do consulting work in your target field. This builds a track record that demonstrates your commitment and capability. It also helps you confirm the new direction is right before making a full transition.',
        },
        {
          heading: 'Leverage Your Network Strategically',
          body: 'Connect with people who have made similar transitions. They can provide practical advice, introduce you to the right people, and help you avoid common mistakes. Be specific about what you are looking for when reaching out.',
        },
        {
          heading: 'Plan the Financial Transition',
          body: 'Career pivots often involve a temporary income reduction. Build a financial cushion before making the move. Having six to twelve months of expenses saved gives you the runway to invest in your transition without constant financial pressure.',
        },
      ],
    },
  },
  {
    slug: 'building-your-personal-brand',
    category: 'Job Search',
    size: 'small',
    visual: 'gradient-teal',
    icon: 'user',
    image: '/resources/personal-brand.jpg',
    title: 'Building Your Personal Brand',
    description: 'Position yourself through your portfolio, LinkedIn, and professional network.',
    content: {
      intro:
        'Your personal brand is how others perceive you professionally. A strong brand makes you memorable, builds trust, and creates opportunities before you even apply for them.',
      sections: [
        {
          heading: 'Define Your Professional Narrative',
          body: 'What do you want to be known for? Identify two to three core areas of expertise and build your brand around them. Your narrative should be consistent across your resume, LinkedIn, portfolio, and personal website. Clarity is more powerful than breadth.',
        },
        {
          heading: 'Optimize Your LinkedIn Presence',
          body: 'LinkedIn is often the first place recruiters and hiring managers look. Use a professional photo, write a compelling headline that goes beyond your job title, and fill your summary with keywords relevant to your target roles. Share and comment on industry content regularly.',
        },
        {
          heading: 'Create and Share Content',
          body: 'Writing articles, sharing insights, or creating short-form content positions you as a thoughtful contributor to your field. You do not need to become a full-time content creator. Consistent, genuine sharing of your professional perspective is enough.',
        },
        {
          heading: 'Build Relationships, Not Just Connections',
          body: 'A network of 5,000 strangers is less valuable than 200 meaningful professional relationships. Focus on genuine interactions, offering help before asking for it, and following up with people you meet. Quality connections lead to real opportunities.',
        },
        {
          heading: 'Maintain Consistency Over Time',
          body: 'Personal branding is a long game. Show up consistently, deliver on your promises, and let your work speak for itself. The most effective personal brands are built through years of reliable, high-quality contributions.',
        },
      ],
    },
  },
  {
    slug: 'writing-a-resume-that-gets-interviews',
    category: 'Career Advice',
    size: null,
    visual: null,
    icon: null,
    image: '/resources/resume-writing.jpg',
    title: 'Writing a Resume That Gets Interviews',
    description:
      'How to structure your resume, highlight impact, and tailor it for each application without starting from scratch every time.',
    content: {
      intro:
        'Your resume is a marketing document, not a biography. Its sole purpose is to get you an interview. A well-crafted resume highlights your impact and makes it easy for a hiring manager to see your value.',
      sections: [
        {
          heading: 'Lead with Impact, Not Responsibilities',
          body: 'Replace responsibility-based bullet points with achievement-based ones. Instead of "Managed a team of five," write "Led a five-person team to deliver a $2M project two weeks ahead of schedule." Use the formula: Action verb + What you did + Measurable result.',
        },
        {
          heading: 'Tailor for Each Application',
          body: 'You do not need to rewrite your resume from scratch for every job. Instead, maintain a master resume with all your experience, then selectively highlight the most relevant items for each application. Mirror the language from the job description.',
        },
        {
          heading: 'Keep It Clean and Scannable',
          body: 'Use a clean layout with clear section headings, consistent formatting, and adequate white space. Most recruiters spend six to ten seconds on an initial resume scan. Make sure your most impressive achievements are visible above the fold.',
        },
        {
          heading: 'Quantify Everything You Can',
          body: 'Numbers catch the eye and provide concrete evidence of your impact. Revenue generated, costs reduced, processes improved, teams led, customers served \u2014 quantify whatever you can. Even percentages or time frames add credibility.',
        },
        {
          heading: 'Avoid Common Mistakes',
          body: 'Do not use an objective statement (they are outdated). Proofread carefully for typos. Do not include irrelevant personal information. Keep it to two pages maximum for most professionals. Use a professional email address.',
        },
      ],
    },
  },
  {
    slug: 'thriving-in-a-remote-role',
    category: 'Job Search',
    size: null,
    visual: null,
    icon: null,
    image: '/resources/remote-work.jpg',
    title: 'Thriving in a Remote Role',
    description:
      'Communication habits, workspace setup, and routines that help remote employees stay visible and productive.',
    content: {
      intro:
        'Remote work offers flexibility and autonomy, but it also requires discipline, intentional communication, and proactive relationship-building to stay effective and visible.',
      sections: [
        {
          heading: 'Design Your Workspace',
          body: 'Invest in a dedicated workspace with ergonomic furniture, good lighting, and reliable internet. Separate your work area from your living space as much as possible. This physical boundary helps you transition into and out of work mode.',
        },
        {
          heading: 'Establish Clear Communication Habits',
          body: 'Over-communicate rather than under-communicate. Provide regular updates on your progress, flag blockers early, and be explicit about your availability. Use asynchronous communication for non-urgent matters and reserve meetings for discussions that genuinely benefit from real-time conversation.',
        },
        {
          heading: 'Build Visibility Proactively',
          body: 'In a remote environment, out of sight can mean out of mind. Volunteer for projects, share your work in team channels, and participate actively in meetings. Document your contributions so your impact is visible even when you are not physically present.',
        },
        {
          heading: 'Manage Your Time and Energy',
          body: 'Set clear working hours and stick to them. Use time-blocking to protect focused work periods. Take regular breaks to avoid burnout. The flexibility of remote work is a benefit only when you use it intentionally.',
        },
        {
          heading: 'Invest in Relationships',
          body: 'Schedule virtual coffee chats with colleagues, participate in team social activities, and make an effort to build rapport beyond work tasks. Strong professional relationships are harder to build remotely but equally important.',
        },
      ],
    },
  },
  {
    slug: 'preparing-for-technical-interviews',
    category: 'Interviews',
    size: null,
    visual: null,
    icon: null,
    image: '/resources/technical-interview.jpg',
    title: 'Preparing for Technical Interviews',
    description:
      'A structured approach to coding challenges, system design, and demonstrating your problem-solving process.',
    content: {
      intro:
        'Technical interviews test not just your knowledge, but how you approach problems, communicate your thinking, and handle pressure. Preparation is key to performing well.',
      sections: [
        {
          heading: 'Build a Study Plan',
          body: 'Start preparing four to six weeks before your interviews. Focus on data structures, algorithms, system design, and role-specific topics. Use a mix of resources: coding platforms, textbooks, and mock interviews. Consistency matters more than marathon cramming sessions.',
        },
        {
          heading: 'Think Out Loud',
          body: 'Interviewers want to understand your thought process. Talk through your approach before writing code. Ask clarifying questions. Discuss trade-offs between different solutions. This shows you can collaborate and think systematically, even if you do not arrive at the perfect solution immediately.',
        },
        {
          heading: 'Practice Under Realistic Conditions',
          body: 'Solve problems on a whiteboard or in a shared coding document, not just in your comfort zone. Time yourself. Explain your solution to a friend or record yourself. The more you practice under realistic conditions, the less anxious you will feel during the actual interview.',
        },
        {
          heading: 'Master System Design Basics',
          body: 'For system design interviews, practice breaking down complex systems into components. Understand trade-offs between consistency and availability, SQL vs. NoSQL, caching strategies, and load balancing. Focus on high-level architecture before diving into implementation details.',
        },
        {
          heading: 'Follow Up and Reflect',
          body: 'After each interview, write down what went well and what could be improved. If you receive a rejection, ask for feedback. Every interview is a learning opportunity. Track your progress over time to see improvement.',
        },
      ],
    },
  },
  {
    slug: 'understanding-total-compensation',
    category: 'Salary & Compensation',
    size: null,
    visual: null,
    icon: null,
    image: '/resources/total-compensation.jpg',
    title: 'Understanding Total Compensation',
    description:
      'Beyond base salary \u2014 equity, bonuses, benefits, and flexibility all matter. Learn to evaluate the full picture.',
    content: {
      intro:
        'Base salary is just one component of your total compensation. A comprehensive understanding of the full package helps you make better career decisions and negotiate more effectively.',
      sections: [
        {
          heading: 'The Components of Total Compensation',
          body: 'Total compensation typically includes base salary, performance bonuses, equity (stock options or RSUs), signing bonuses, benefits (health, dental, vision), retirement contributions (401k matching), PTO, professional development budgets, and perks like remote work flexibility or wellness stipends.',
        },
        {
          heading: 'How to Compare Offers Fairly',
          body: 'When comparing offers from different companies, evaluate the full package. A company offering $150K base with strong equity and benefits may be a better deal than one offering $170K base with no equity and limited PTO. Use a spreadsheet to compare all components side by side.',
        },
        {
          heading: 'Understanding Equity',
          body: 'Equity can be the most complex and potentially valuable part of your compensation. Understand the difference between stock options and RSUs, know your vesting schedule, and research the company\u2019s valuation and growth trajectory. Unvested equity has real value but also real risk.',
        },
        {
          heading: 'The Value of Non-Monetary Benefits',
          body: 'Flexible work arrangements, generous PTO, learning budgets, and strong company culture have tangible value. Calculate what you would spend on these things if you had to pay for them yourself. A $5,000 learning budget and remote work flexibility may be worth more than a $10,000 salary increase.',
        },
        {
          heading: 'When to Prioritize Different Components',
          body: 'Early in your career, learning opportunities and equity may matter more than base salary. Mid-career, work-life balance and benefits might take priority. Later in your career, compensation and retirement benefits may be most important. Match your priorities to your life stage.',
        },
      ],
    },
  },
  {
    slug: 'researching-company-culture',
    category: 'Company Research',
    size: null,
    visual: null,
    icon: null,
    image: '/resources/company-culture.jpg',
    title: 'How to Research a Company Culture',
    description:
      'Practical methods for understanding team dynamics, management style, and values before you accept an offer.',
    content: {
      intro:
        'Company culture is one of the strongest predictors of job satisfaction. Researching it before you join helps you avoid costly mismatches and find environments where you will thrive.',
      sections: [
        {
          heading: 'Read Between the Lines on Job Descriptions',
          body: 'Job descriptions reveal a lot about culture. Phrases like "fast-paced" may mean chaotic. "Wearing many hats" may mean under-resourced. "Family-like" may mean blurred boundaries. Learn to decode the language companies use and look for patterns across multiple postings.',
        },
        {
          heading: 'Check Employee Reviews Strategically',
          body: 'Sites like Glassdoor and Blind provide employee perspectives. Look for patterns rather than individual reviews. Pay attention to comments about management, work-life balance, and growth opportunities. Be wary of reviews that are purely emotional without specific details.',
        },
        {
          heading: 'Use Your Interview as Research',
          body: 'The interview is a two-way evaluation. Ask questions that reveal culture: "How does the team handle disagreements?" "What is the typical work-week structure?" "Can you describe the last person who was promoted?" Watch how interviewers respond \u2014 their body language tells you as much as their words.',
        },
        {
          heading: 'Connect with Current and Former Employees',
          body: 'Reach out to people who work or worked at the company. Ask open-ended questions about their experience. Former employees may be more candid. LinkedIn makes it easy to find and message people at almost any company.',
        },
        {
          heading: 'Visit the Office (If Possible)',
          body: 'If the role is on-site, visit the office before accepting. Notice the energy level, how people interact, the physical workspace, and whether people seem genuinely engaged or just going through the motions. The environment speaks volumes.',
        },
      ],
    },
  },
  {
    slug: 'in-demand-skills',
    category: 'Job Market',
    size: null,
    visual: null,
    icon: null,
    image: '/resources/in-demand-skills.jpg',
    title: 'In-Demand Skills for 2026',
    description:
      'The competencies hiring managers look for most across engineering, design, product, and operations.',
    content: {
      intro:
        'The skills that employers value evolve with technology and market conditions. Staying current with in-demand competencies helps you remain competitive and position yourself for the roles you want.',
      sections: [
        {
          heading: 'Technical Skills in High Demand',
          body: 'AI and machine learning literacy is increasingly expected across roles, not just in engineering. Data analysis, cloud computing, and cybersecurity remain strong. For developers, TypeScript, React, and Python continue to be highly valued. Low-code and no-code platform experience is growing.',
        },
        {
          heading: 'The Rise of AI Literacy',
          body: 'Understanding how to work effectively with AI tools is becoming a baseline expectation. This does not mean becoming an AI engineer. It means knowing how to use AI assistants, understand their limitations, evaluate their outputs, and integrate them into your workflow productively.',
        },
        {
          heading: 'Soft Skills That Differentiate',
          body: 'As AI handles more routine tasks, human skills become more valuable. Communication, critical thinking, adaptability, emotional intelligence, and the ability to collaborate across disciplines are increasingly what separate good candidates from great ones.',
        },
        {
          heading: 'Cross-Functional Skills',
          body: 'The ability to work across disciplines is highly valued. A designer who understands basic data analysis, a developer who can communicate with stakeholders, or a marketer who understands technical constraints brings outsized value to any team.',
        },
        {
          heading: 'How to Build In-Demand Skills',
          body: 'Focus on learning by doing. Take on projects that stretch your abilities. Complete relevant certifications. Contribute to open-source or community projects. Build a portfolio that demonstrates your skills in action. Continuous learning is the most in-demand skill of all.',
        },
      ],
    },
  },
];

export function getResourceBySlug(slug) {
  return RESOURCES.find((r) => r.slug === slug) || null;
}

export function getResourcesByCategory(category) {
  if (!category || category === 'All') return RESOURCES;
  return RESOURCES.filter(
    (r) => r.category.toLowerCase() === category.toLowerCase()
  );
}

export function getRelatedResources(currentSlug, limit = 3) {
  const current = getResourceBySlug(currentSlug);
  if (!current) return RESOURCES.slice(0, limit);
  return RESOURCES.filter(
    (r) => r.slug !== currentSlug && r.category === current.category
  )
    .slice(0, limit)
    .concat(
      RESOURCES.filter(
        (r) => r.slug !== currentSlug && r.category !== current.category
      ).slice(0, limit)
    )
    .slice(0, limit);
}
