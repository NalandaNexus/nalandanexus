/**
 * GARUD, months 7-9: applied investigation, technical communication, leadership,
 * security operations, and the capstone that puts all three subjects together.
 *
 * Month 9 is deliberately assessed across subjects rather than within one. A
 * student who can analyse evidence but cannot explain it has not finished the
 * stage, and the final assessment is tagged to reflect that the work genuinely
 * spans English, Computer and Cybersecurity.
 */

export const MASTERY = [
  {
    moduleId: 'garud-m13',
    title: 'Month 7 · Digital Investigation Lab',
    order: 13,
    subject: 'CYBERSECURITY',
    lessons: [
      {
        lessonId: 'garud-m13-l01',
        title: '13.1 Investigation Preparation',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Deciding the question, the scope and the authority before touching anything.',
        content:
          'Investigations go wrong at the beginning more often than in the middle. Preparation is what prevents it.\n\n' +
          'Start by writing the question. "Find out what happened" is not a question; "did customer data leave the network between the 3rd and the 10th, and if so how" is. A written question keeps the work bounded, because investigations expand naturally and an unbounded one never finishes.\n\n' +
          'Then scope: which systems, which accounts, which period. Then authority: who has authorised this, and does that authorisation actually cover the scope you just wrote.\n\n' +
          'Then practicalities - where evidence will be stored, who else is involved, and how you will communicate. Decide in advance how you will handle finding something outside the question, because you will, and deciding in the moment is how scope quietly disappears.\n\n' +
          'Finally, consider what you expect to find. Writing it down before you look is what later lets you notice that you found what you expected regardless of the evidence.',
      },
      {
        lessonId: 'garud-m13-l02',
        title: '13.2 Evidence Collection Concepts',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Collecting in the right order and recording enough to defend it.',
        content:
          'Collection applies month 6\'s principles under time pressure, which is when they are hardest to follow.\n\n' +
          'Work in order of volatility: memory and live connections before disk, disk before backups. Collect from the widest useful set of sources, because a single source rarely establishes a sequence - a workstation alone tells you what it did, not what it was talking to.\n\n' +
          'Record at collection time: what the item is, where it came from, exactly when, who collected it, the tool used, and the hash. Recording afterwards is how gaps appear.\n\n' +
          'Collect more than you currently need, within your authorised scope. Returning for something you did not take is often impossible - logs roll over, machines are rebuilt, and the window closes. Over-collection within scope is recoverable; under-collection usually is not.\n\n' +
          'Be aware that collection itself changes things. Running a tool on a live machine writes to memory and may write to disk. That is acceptable and unavoidable; what is not acceptable is failing to record that you did it.',
      },
      {
        lessonId: 'garud-m13-l03',
        title: '13.3 Timeline Analysis',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'Building a defensible sequence from sources that disagree.',
        content:
          'A timeline is the backbone of an investigation. Most questions - what happened first, what caused what, how long did this go on - are answered by ordering events correctly.\n\n' +
          'Build it by normalising every source into one timezone, stating which, and recording for each entry the time, the source, what happened, and your confidence in it. UTC is the usual choice precisely because it removes daylight-saving ambiguity.\n\n' +
          'Sources will disagree. A server eleven minutes fast puts its events in the wrong place relative to everything else, and if you do not detect that, your sequence is wrong in a way that looks entirely convincing. Look for an event recorded by two systems and use the offset between them to correct.\n\n' +
          'Gaps carry information. A period with no logging may mean nothing happened, or that logging was off, or that entries were removed. Those are very different, and the timeline should show the gap rather than close over it.\n\n' +
          'Keep the timeline factual. Interpretation belongs in the analysis; a timeline entry saying "attacker moves laterally" has smuggled a conclusion into the evidence.',
      },
      {
        lessonId: 'garud-m13-l04',
        title: '13.4 File Metadata',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'What files record about themselves, and how far to trust it.',
        content:
          'Files carry data about themselves beyond their contents, and it is frequently more useful than the contents.\n\n' +
          'File system metadata includes created, modified and accessed times, size, owner and permissions. Documents carry their own embedded metadata - author, organisation, the software that produced it, revision history, and sometimes earlier text that was edited out. Photographs may carry camera details and location.\n\n' +
          'Embedded metadata is a recurring source of accidental disclosure: a document published publicly that names its author and the internal path it was saved to.\n\n' +
          'Trust it carefully. File system timestamps can be altered deliberately. Embedded metadata can be edited. Copying a file often resets some timestamps as a matter of routine, with no ill intent at all.\n\n' +
          'The useful technique is comparison. A file whose embedded creation date precedes its file system creation date by a year is unremarkable if it was copied. A file whose timestamps are internally inconsistent in a way copying does not explain is a question worth pursuing - a discrepancy is a lead, not a conclusion.',
      },
      {
        lessonId: 'garud-m13-l05',
        title: '13.5 Basic Log Analysis',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'Working through volume to the entries that matter.',
        content:
          'Logs are usually the richest evidence and arrive in quantities no one can read directly. Analysis is the process of reduction.\n\n' +
          'Start by narrowing hard: the time window from your timeline, the accounts or hosts in scope. Most of the volume is irrelevant to your question and removing it is the first and largest win.\n\n' +
          'Then look for the shapes from month 6. Authentication failures followed by a success. Access at a time that account never normally acts. A rate of activity no human produces. A sequence repeating at a fixed interval.\n\n' +
          'Absence is evidence too. If a system that logs every login has no entry for a period when you know someone logged in, that absence is a finding.\n\n' +
          'Two disciplines keep this honest. Record the exact filters you applied, because your conclusion depends on what you excluded as much as what you found. And check a sample of what you filtered out - a filter that was slightly wrong silently removes the thing you were looking for, and you will never notice.',
      },
      {
        lessonId: 'garud-m13-l06',
        title: '13.6 Evidence Reporting',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'Writing findings so they can be acted on and challenged.',
        content:
          'A finding nobody understands has the same practical value as no finding.\n\n' +
          'Structure a report so it serves two readers at once. A summary at the front states what happened, what the impact is and what should be done, in language a non-specialist can act on. The detail behind it supports every claim, for the specialist who needs to check.\n\n' +
          'Every factual claim should be traceable to evidence - which log, which file, which timestamp. A reader who cannot check your conclusion has to take it on trust, and trust is not what a report is for.\n\n' +
          'State confidence explicitly and separately for each finding. It is entirely normal for one part to be confirmed and another only likely, and flattening both into the same confident tone misrepresents the work.\n\n' +
          'Say what you could not establish. An investigation that reports only its successes implies completeness it does not have. "We could not determine whether data was copied, because the relevant logs were retained for only seven days" is a finding, and often an important one.',
      },
    ],
    quizzes: [],
    tasks: [
      {
        taskId: 'garud-m13-a01',
        title: 'Mini Digital Investigation',
        type: 'Activity',
        subject: 'CYBERSECURITY',
        urgency: 'high',
        pointsReward: 80,
        dueOffsetDays: 18,
        iconName: 'FileSearch',
        description:
          'A complete small investigation using only the evidence supplied below. Nothing here is to be tested against a real system.\n\n' +
          'EVIDENCE PACKAGE. Authentication log (server time, UTC+0):\n' +
          '  02:41 FAIL user=r.mehta src=203.0.113.44\n' +
          '  02:41 FAIL user=r.mehta src=203.0.113.44\n' +
          '  02:42 FAIL user=r.mehta src=203.0.113.44\n' +
          '  02:44 OK   user=r.mehta src=203.0.113.44\n' +
          '  02:58 OK   user=admin.svc src=10.4.2.19\n' +
          'File server log (server time, UTC+5:30, clock verified correct):\n' +
          '  08:31 READ  /finance/payroll-2026.xlsx user=r.mehta\n' +
          '  08:34 COPY  /finance/ -> /tmp/archive.zip user=r.mehta\n' +
          'Network flow summary (UTC+0):\n' +
          '  03:06-03:19 10.4.2.19 -> 198.51.100.7:443, 1.4 GB outbound\n' +
          'Context: r.mehta is a finance analyst whose normal working hours are 09:00-17:30 local (UTC+5:30). 10.4.2.19 is a file server. Log retention is 30 days.\n\n' +
          'Produce:\n' +
          '1. A timeline normalised to a single timezone, stating which you chose. Note that the two logs use different timezones - this is the point of the exercise.\n' +
          '2. For each entry: source, what it shows, and your confidence.\n' +
          '3. What the three failures followed by a success most likely indicates, and what would confirm it.\n' +
          '4. Whether the 1.4 GB transfer can be attributed to this account on this evidence - and if not, exactly what is missing.\n' +
          '5. Two things you cannot determine from this package, and what evidence would settle each.\n' +
          '6. A findings summary of under 200 words for a non-technical manager.\n\n' +
          'Assessed on: whether you correctly reconcile the two timezones, whether you separate evidence from inference throughout, and whether item 5 is genuine - an investigation reporting only what it found implies a completeness it does not have.',
      },
    ],
  },

  {
    moduleId: 'garud-m14',
    title: 'Month 7 · Technical Communication',
    order: 14,
    subject: 'ENGLISH',
    lessons: [
      {
        lessonId: 'garud-m14-l01',
        title: '14.1 Writing Technical Reports',
        duration: '24 mins',
        subject: 'ENGLISH',
        summary: 'A structure that serves the decision-maker and the specialist at once.',
        content:
          'A technical report has two audiences with opposite needs. One must decide something and has little time; the other must verify your work and needs everything.\n\n' +
          'Layering serves both. The summary comes first: what happened, what it means, what you recommend, in a page or less and without jargon. Then the detail, organised so a specialist can follow the method. Then appendices for raw material.\n\n' +
          'This is the opposite of how the work was done, and that is deliberate. You investigated from evidence towards a conclusion; the reader needs the conclusion first, then the evidence for it.\n\n' +
          'Write the summary last, and write it for someone who will read nothing else. If the summary alone would lead a competent manager to the right decision, it works.\n\n' +
          'Be precise about certainty throughout. "The account was used to copy the files" and "files were copied using that account\'s credentials" differ in exactly the way that matters - the second does not assert who was at the keyboard.',
      },
      {
        lessonId: 'garud-m14-l02',
        title: '14.2 Explaining Technical Findings',
        duration: '22 mins',
        subject: 'ENGLISH',
        summary: 'Translating a technical result into a consequence someone can act on.',
        content:
          'A finding becomes useful when the listener understands what it means for them, which is rarely the same as what it means technically.\n\n' +
          'The move is to translate mechanism into consequence. "The server was running an unpatched version of the library" is a mechanism. "Anyone on the internet could read customer records without logging in, and we cannot tell from the logs whether they did" is the consequence, and it is what a manager needs in order to decide anything.\n\n' +
          'Lead with the consequence, then give the mechanism for those who want it.\n\n' +
          'Quantify where you can. "Several hundred records" beats "some data". Where you cannot quantify, say so plainly rather than reaching for a vague word that will be read as a number anyway.\n\n' +
          'Avoid two failure modes. Overstating - describing a theoretical weakness in the language of an active breach - destroys credibility when the truth emerges. Understating to avoid alarm leaves the decision-maker under-informed, and they will reasonably be angry later.',
      },
      {
        lessonId: 'garud-m14-l03',
        title: '14.3 Evidence-Based Communication',
        duration: '22 mins',
        subject: 'ENGLISH',
        summary: 'Making claims that can be checked, and marking the ones that cannot.',
        content:
          'In technical work, a claim is only as good as the reader\'s ability to verify it.\n\n' +
          'Attach the source to each substantive claim: which log, which file, which measurement, at which time. This is not padding - it is what lets a reader who doubts you resolve the doubt themselves, which is faster and less adversarial than arguing.\n\n' +
          'Distinguish three categories explicitly. What the evidence shows. What you infer from it. What you were told but have not verified. All three belong in a report; conflating them is what turns a reasonable inference into a fact nobody can trace.\n\n' +
          'Where evidence is absent, say what is absent and why. "No DNS logs exist for this period" is more useful than silence, because silence reads as "nothing was found there", which is a different claim.\n\n' +
          'Present contradicting evidence as well as supporting evidence. A report that acknowledges the one log entry that does not fit is far more credible than one that quietly omits it - and if a reader finds the omission themselves, everything else you wrote comes into question.',
      },
      {
        lessonId: 'garud-m14-l04',
        title: '14.4 Presentation of Findings',
        duration: '22 mins',
        subject: 'ENGLISH',
        summary: 'Presenting an investigation to people who will make a decision from it.',
        content:
          'Presenting findings is not reading the report aloud. The room needs to reach a decision, and you are there to enable that.\n\n' +
          'Open with the conclusion and its significance in two sentences, then say what you will cover. People listen better once they know where you are going.\n\n' +
          'Use the timeline as the spine. A sequence of events is the easiest technical structure for a non-specialist to follow, because it maps to how people naturally think about what happened.\n\n' +
          'Show the evidence for the claims that matter most - one log excerpt on screen, highlighted, is worth several paragraphs of assertion. Do not show everything; show the pivotal thing.\n\n' +
          'Be explicit about what remains uncertain, and place it before the recommendations rather than after. A recommendation offered without its caveats will be acted on without them.\n\n' +
          'End with what you are asking the room to decide. A presentation that finishes with "any questions?" and no ask frequently produces agreement and no action.',
      },
      {
        lessonId: 'garud-m14-l05',
        title: '14.5 Handling Questions',
        duration: '22 mins',
        subject: 'ENGLISH',
        summary: 'Answering challenge, hostility and questions you cannot answer.',
        content:
          'Questions after a technical presentation are where credibility is won or lost, because this is the unscripted part.\n\n' +
          'Listen to the whole question. Answering the question you assumed was coming is the most common error and is immediately obvious to everyone present.\n\n' +
          'Answer the question asked, then stop. Over-answering - continuing past the answer into related material - reads as nervousness and frequently introduces something new to be challenged on.\n\n' +
          'When you do not know: say so, say what you would need to find out, and commit to a time. Do not speculate while appearing to state fact. If you do speculate deliberately, label it: "I would guess, and this is a guess, that..."\n\n' +
          'When a question is hostile, answer the technical content and decline the framing. "Why did you miss this?" can be answered as "the logs covering that period were retained for seven days, so it was not visible - here is what would have made it visible". You have answered honestly without accepting a premise you disagree with.\n\n' +
          'When you are wrong, say so immediately and plainly. Defending an error costs far more than the error.',
      },
      {
        lessonId: 'garud-m14-l06',
        title: '14.6 Professional Documentation',
        duration: '22 mins',
        subject: 'ENGLISH',
        summary: 'Writing documents that remain useful after you have gone.',
        content:
          'Documentation is written for a reader who has less context than you and cannot ask you anything.\n\n' +
          'Record decisions with their reasoning. A document stating what was decided but not why invites someone to reverse it next year without knowing what it was solving - and that is how resolved problems come back.\n\n' +
          'Write procedures as steps someone can follow without prior knowledge, including the prerequisites and what a successful result looks like. A procedure that does not say how to tell whether it worked is incomplete.\n\n' +
          'Date everything and say what version of what it applies to. Undated documentation becomes untrustworthy quickly, because nobody can tell whether it predates the change they are asking about.\n\n' +
          'Keep it where it will be found. Excellent documentation in a folder nobody knows about is equivalent to none.\n\n' +
          'And write it as you go. Documentation deferred until the end is written from memory, and memory is tidier, more linear and more flattering than what actually happened.',
      },
    ],
    quizzes: [],
    tasks: [
      {
        taskId: 'garud-m14-a01',
        title: 'Present an Investigation Report',
        type: 'Task',
        subject: 'ENGLISH',
        urgency: 'high',
        pointsReward: 70,
        dueOffsetDays: 14,
        iconName: 'FileBarChart',
        description:
          'Turn your month 7 investigation into a report and a presentation. This assesses the communication, not the investigation.\n\n' +
          'Part 1 - the report. Using your findings from the Mini Digital Investigation, write a report containing: a summary of at most one page written for a manager with no technical background; the detailed findings, each traceable to a specific piece of evidence; an explicit statement of what could not be determined and why; and your recommendations.\n\n' +
          'Every substantive claim must name its source. Every finding must carry a confidence level. The summary must be readable by someone who will read nothing else.\n\n' +
          'Part 2 - the presentation. Prepare a five-minute version for a decision-making meeting. Submit slides or notes, plus: the two-sentence opening, the single piece of evidence you would put on screen and why that one, and the specific decision you are asking the room to make.\n\n' +
          'Part 3 - anticipated questions. Write the three hardest questions you could be asked, with your honest answers. At least one must be a question you cannot fully answer.\n\n' +
          'Assessed on: whether the summary would lead a competent manager to a sound decision on its own, whether claims are traceable, whether uncertainty is stated rather than smoothed over, and whether part 3 is genuinely difficult rather than three easy questions.',
      },
    ],
  },

  {
    moduleId: 'garud-m15',
    title: 'Month 8 · Leadership',
    order: 15,
    subject: 'ENGLISH',
    lessons: [
      {
        lessonId: 'garud-m15-l01',
        title: '15.1 Leadership Fundamentals',
        duration: '22 mins',
        subject: 'ENGLISH',
        summary: 'Leading as a set of behaviours rather than a position.',
        content:
          'Leadership is what you do, not what you are called. The people who set direction and standards in a team are frequently not the people with the title.\n\n' +
          'Three behaviours account for most of it. Setting direction: making it clear what matters and what good looks like, so people can make their own decisions consistently instead of asking. Removing obstacles: most people want to do good work, and a great deal of leadership is clearing what is stopping them. Taking responsibility: publicly owning the team\'s failures and publicly attributing its successes, in that order.\n\n' +
          'That last one is the hardest and the most diagnostic. A leader who takes credit and distributes blame will have a team that hides problems, and hidden problems are how small failures become large ones.\n\n' +
          'You do not need authority to do any of these. In security work specifically, the person who notices something and says so clearly is leading, whatever their role.',
      },
      {
        lessonId: 'garud-m15-l02',
        title: '15.2 Team Communication',
        duration: '22 mins',
        subject: 'ENGLISH',
        summary: 'Keeping a team informed without burying it.',
        content:
          'Teams fail from communication far more often than from capability.\n\n' +
          'Two opposite failures. Too little: people work on the wrong thing, duplicate effort, or discover a decision after it affects them. Too much: everything is copied to everyone, nobody can tell what requires their attention, and important messages are missed in the volume. The second is more common and is often mistaken for transparency.\n\n' +
          'Match the channel to the message. Decisions and anything needing a record go somewhere durable and findable. Quick coordination goes to chat. Anything sensitive, difficult or likely to be misread goes to a conversation, because tone does not survive text.\n\n' +
          'Make the status of information explicit: is this a decision, a proposal, or thinking aloud? Enormous confusion comes from a senior person musing and a team treating it as an instruction.\n\n' +
          'Close loops. If someone raises something, tell them what happened to it, even when the answer is no. People stop reporting things when reporting appears to achieve nothing - and in security that silence is expensive.',
      },
      {
        lessonId: 'garud-m15-l03',
        title: '15.3 Delegation',
        duration: '20 mins',
        subject: 'ENGLISH',
        summary: 'Handing over work properly, including the authority to do it.',
        content:
          'Delegation fails when responsibility is transferred and authority is not. Asking someone to deliver something while requiring your approval for every decision is not delegation; it is supervision with extra steps, and it produces frustration on both sides.\n\n' +
          'Delegate the outcome, not the method. State what needs to be true when it is done, the constraints that are genuinely fixed, and the decisions the person may make alone. Then let them choose how. Their approach will differ from yours, and differing is not the same as wrong.\n\n' +
          'Be explicit about what must come back to you. "Decide anything under this budget yourself; anything above, check with me" is workable. "Use your judgement" without a boundary is a trap, because the boundary exists in your head and will only be discovered by being crossed.\n\n' +
          'Accountability does not transfer. If it goes wrong, it is still yours, and behaving otherwise is the fastest way to ensure nobody accepts delegated work from you again.',
      },
      {
        lessonId: 'garud-m15-l04',
        title: '15.4 Conflict Resolution',
        duration: '22 mins',
        subject: 'ENGLISH',
        summary: 'Separating disagreements about facts, priorities and process.',
        content:
          'Most workplace conflict is not personal, though it becomes personal when left alone. The first move is to identify what kind of disagreement it actually is.\n\n' +
          'A disagreement about facts is the easiest: the parties believe different things about the world and it can be checked. A disagreement about priorities is harder, because both parties may be right about their own objective and the conflict is real - it needs a decision, usually from someone with the standing to make it. A disagreement about process is often the invisible one: people agree on the goal and disagree on how, and argue about the goal by proxy.\n\n' +
          'Address the substance before the feelings, but do not pretend the feelings are absent. "I think we disagree about whether speed or coverage matters more here - is that right?" often defuses something that looked like hostility.\n\n' +
          'Deal with it early and directly. Unaddressed conflict does not stay the same size; it acquires history, and the history becomes harder to resolve than the original disagreement.',
      },
      {
        lessonId: 'garud-m15-l05',
        title: '15.5 Decision Making',
        duration: '22 mins',
        subject: 'ENGLISH',
        summary: 'Making decisions for a team - visibly, and with the reasoning attached.',
        content:
          'Team decisions have a requirement individual ones do not: people must be able to act on them without you, which means they must understand them.\n\n' +
          'Say who decides before the discussion. A conversation where people believe they are deciding, which is actually consultative, produces resentment that outlasts the decision itself. "I want your input and I will decide by Friday" is honest and entirely acceptable.\n\n' +
          'Decide at the right speed. Reversible decisions should be made fast, because deliberation costs more than the mistake. Irreversible ones deserve the time. Treating every decision as consequential is a way of making none of them.\n\n' +
          'Communicate the reasoning, not just the outcome. People who understand why can apply it to the next situation; people who only know the ruling will ask again, or apply it where it does not fit.\n\n' +
          'Once decided, commit - including those who argued against it. A team that continues relitigating cannot execute, and the appearance of an open question invites it to be reopened by whoever is most persistent rather than most correct.',
      },
      {
        lessonId: 'garud-m15-l06',
        title: '15.6 Professional Ethics',
        duration: '24 mins',
        subject: 'ENGLISH',
        summary: 'The obligations that come with access, and what to do under pressure.',
        content:
          'Technical work confers access to information and systems that people have not really consented to you seeing. That access is the ethical issue.\n\n' +
          'Three obligations follow. Confidentiality: what you see in the course of your work is not yours to repeat, including things that are merely interesting. Competence: not claiming capability you lack, because in security an overstated capability leaves someone believing they are protected when they are not. Honesty about findings: reporting what is there, including when it is inconvenient, embarrassing, or your own mistake.\n\n' +
          'Pressure is where ethics becomes real. You will at some point be asked to soften a finding, delay a disclosure, or not look somewhere. Often the request is reasonable, and sometimes it is not. The distinction worth holding is between adjusting how something is communicated - legitimate - and changing what is reported as true, which is not.\n\n' +
          'When unsure, ask whether you would be comfortable with the decision and your reasoning being known. It is an imperfect test that catches most of the cases that matter.',
      },
    ],
    quizzes: [],
    tasks: [],
  },

  {
    moduleId: 'garud-m16',
    title: 'Month 8 · Security Operations',
    order: 16,
    subject: 'CYBERSECURITY',
    lessons: [
      {
        lessonId: 'garud-m16-l01',
        title: '16.1 The Security Operations Centre',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'How monitoring is organised as continuous work rather than a project.',
        content:
          'A security operations centre is the function that watches continuously and responds. It may be a room of analysts, a few people with other duties, or a contracted service - the organising idea is the same.\n\n' +
          'Work is usually tiered. The first tier triages alerts: is this real, and how urgent? Most alerts are not incidents, and the first tier\'s job is to establish that quickly and accurately. The second tier investigates what survives triage. A third tier handles the most complex cases and improves detection so that recurring false positives stop arriving.\n\n' +
          'The defining constraint is attention. There are always more alerts than analysts, so the real question is not whether you can detect something but whether anyone will look at it. A detection rule that fires two hundred times a day will be ignored within a week, and it will be ignored on the day it is right.\n\n' +
          'This is why tuning is not administrative overhead. It is what makes detection function at all.',
      },
      {
        lessonId: 'garud-m16-l02',
        title: '16.2 Alert Monitoring',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Triage: deciding fast and correctly what deserves attention.',
        content:
          'Triage answers two questions quickly: is this real, and does it matter now?\n\n' +
          'Work from context rather than the alert text alone. The same alert means different things on a developer\'s laptop and on a payment server. Asking what this host is, who uses it, and what it normally does resolves a large proportion of alerts immediately.\n\n' +
          'Look for corroboration before escalating. A single alert with nothing else around it is frequently noise; the same alert alongside an unusual authentication and an unfamiliar outbound connection is a different matter. Correlation is what turns three weak signals into one strong one.\n\n' +
          'Record the decision either way, including dismissals and the reason. A dismissed alert with no note is indistinguishable later from one nobody looked at, and post-incident review will find that gap.\n\n' +
          'Escalate on uncertainty rather than on certainty. Triage is not meant to determine the answer; it is meant to determine who should be looking.',
      },
      {
        lessonId: 'garud-m16-l03',
        title: '16.3 Incident Classification',
        duration: '20 mins',
        subject: 'CYBERSECURITY',
        summary: 'Consistent severity, so response matches consequence.',
        content:
          'Classification decides how much response an event gets, and it needs to be consistent or it becomes a popularity contest between whoever shouts loudest.\n\n' +
          'Severity is normally driven by impact - what is affected and how badly - modified by scope and by urgency. A confirmed compromise of one workstation and a suspected compromise of the authentication system are not the same, and the criteria should make that obvious without debate.\n\n' +
          'Define the levels in terms of consequence, not technology: whether data is confirmed exposed, whether business operations are stopped, whether the affected system holds sensitive information, how many people are affected.\n\n' +
          'Two failure modes. Under-classification delays response and means the incident is larger by the time anyone treats it seriously. Over-classification exhausts people, and a team that has been woken three times for nothing responds slowly the fourth time.\n\n' +
          'Classification is provisional. Reclassify as evidence arrives - and record when and why it changed, because that trail is exactly what a review will want.',
      },
      {
        lessonId: 'garud-m16-l04',
        title: '16.4 Log Analysis in Operations',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Using logs at operational speed, and aggregating them so that is possible.',
        content:
          'Operational log analysis differs from forensic analysis in its constraint: you have minutes, not days.\n\n' +
          'That makes aggregation essential. Logs scattered across hundreds of machines cannot be searched during an incident. Central collection, with consistent timestamps and enough retention, is what makes a question answerable at the moment it is asked.\n\n' +
          'Know a small set of questions and how to answer each fast: where else has this account authenticated, what else has this host connected to, has this file appeared anywhere else, what happened on this host either side of this time. Those four cover a great deal of early incident work.\n\n' +
          'Saved searches matter. Reconstructing a complex query during an incident wastes the time you least have, and produces mistakes.\n\n' +
          'Retention is the limit you will meet repeatedly. Seven days feels adequate until the intrusion started in the third week, which is normal - intrusions are typically discovered long after they begin. Retention is a decision made calmly in advance that determines what is knowable later.',
      },
      {
        lessonId: 'garud-m16-l05',
        title: '16.5 Security Events and Correlation',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Turning many weak signals into one strong finding.',
        content:
          'Individually, most security events are unremarkable. A failed login is ordinary. A new process is ordinary. An outbound connection is ordinary. Correlation is what finds the combination that is not.\n\n' +
          'Correlate across three dimensions. Time: events close together are more likely related, which is why clock synchronisation keeps recurring. Entity: events involving the same account, host or address. Sequence: events in an order that matches a known pattern - authentication failure, then success, then privilege change, then access to data that account has never touched.\n\n' +
          'That sequence is much stronger evidence than any of its four parts alone, and none of the four would justify waking anyone.\n\n' +
          'The risk is spurious correlation. In a large enough environment, unrelated things co-occur constantly. Ask how often this combination appears normally - if the answer is "several times a day", it is not a finding.\n\n' +
          'This is the operational version of the pattern-recognition lesson: the discipline is to test the pattern before believing it.',
      },
      {
        lessonId: 'garud-m16-l06',
        title: '16.6 Incident Escalation',
        duration: '20 mins',
        subject: 'CYBERSECURITY',
        summary: 'Knowing when to hand on, and handing on cleanly.',
        content:
          'Escalation is a routine part of the process, not an admission of failure. The common error is escalating too late - trying to resolve something alone while the incident grows.\n\n' +
          'Escalate when the incident exceeds your authority to act, exceeds your expertise, affects systems or people outside your scope, or when you are simply uncertain and the potential impact is high. Uncertainty plus high impact is a sufficient reason on its own.\n\n' +
          'A clean handover is a specific thing: what you know, what you did, what you have not checked, and what you believe is happening, clearly labelled as belief. Including what you have not checked is what stops the next person repeating your steps instead of extending them.\n\n' +
          'Escalation paths must be established beforehand, with names and contact methods, including out of hours. An incident at 02:00 is the wrong moment to discover that nobody knows who to call.\n\n' +
          'Escalating does not end your involvement unless someone says so. Stay available - you hold context that is not in the notes.',
      },
    ],
    quizzes: [
      {
        quizId: 'garud-m16-q01',
        title: 'Security Operations Assessment',
        subject: 'CYBERSECURITY',
        timeLimitMins: 15,
        pointsReward: 60,
        questions: [
          {
            questionId: 'q1',
            question: 'A detection rule fires around two hundred times a day, almost always harmlessly. What is the real risk?',
            options: [
              'It consumes too much storage',
              'Analysts will ignore it, including on the day it is correct',
              'It will slow down the network',
              'It cannot be tuned once deployed',
            ],
            correctIndex: 1,
            explanation:
              'Detection is limited by attention, not by sensors. An alert nobody reads is worth nothing, which is why tuning is what makes detection function rather than administrative overhead.',
          },
          {
            questionId: 'q2',
            question: 'Which combination is strongest evidence of a real intrusion?',
            options: [
              'A single failed login',
              'A new process on a workstation',
              'Failed logins, then a success, then a privilege change, then access to data that account never touches',
              'An outbound HTTPS connection',
            ],
            correctIndex: 2,
            explanation:
              'Correlation across time, entity and sequence. None of the four parts alone would justify waking anyone; in that order, against one account, they are a different matter.',
          },
          {
            questionId: 'q3',
            question: 'You dismiss an alert as a false positive. What must you do?',
            options: [
              'Nothing - dismissal is the record',
              'Record the decision and the reason',
              'Delete the alert so it does not recur',
              'Escalate it anyway',
            ],
            correctIndex: 1,
            explanation:
              'A dismissed alert with no note is indistinguishable later from one nobody looked at, and a post-incident review will find exactly that gap.',
          },
          {
            questionId: 'q4',
            question: 'Log retention is seven days. Why is this frequently inadequate?',
            options: [
              'Logs become corrupted after a week',
              'Intrusions are typically discovered long after they begin, so the start falls outside the window',
              'Seven days exceeds most storage budgets',
              'Retention has no effect on investigation',
            ],
            correctIndex: 1,
            explanation:
              'Retention is a decision made calmly in advance that silently determines what is knowable later. Discovery routinely lags the intrusion by weeks.',
          },
          {
            questionId: 'q5',
            question: 'When is uncertainty alone a sufficient reason to escalate?',
            options: [
              'Never - escalate only once you are certain',
              'When the potential impact is high',
              'Only at the end of a shift',
              'Only if a manager asks',
            ],
            correctIndex: 1,
            explanation:
              'Uncertainty plus high potential impact is sufficient on its own. Triage exists to decide who should be looking, not to determine the answer.',
          },
          {
            questionId: 'q6',
            question: 'What must a clean handover include that is most often omitted?',
            options: [
              'The time the incident started',
              'What you have not yet checked',
              'The name of the alerting tool',
              'A severity rating',
            ],
            correctIndex: 1,
            explanation:
              'Stating what you have not checked is what stops the next person repeating your steps instead of extending them - and it is the part people leave out.',
          },
        ],
      },
    ],
    tasks: [],
  },

  {
    moduleId: 'garud-m17',
    title: 'Month 9 · Integrated Cyber Investigation',
    order: 17,
    subject: 'CYBERSECURITY',
    lessons: [
      {
        lessonId: 'garud-m17-l01',
        title: '17.1 The Case: Briefing',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'The scenario you will work for the rest of the stage, and the question you are answering.',
        content:
          'This is the case you will investigate across the capstone. Everything needed is supplied; nothing is to be tested against any real system.\n\n' +
          'BRIEFING. Meridian Tutorials is a 40-person education company. On Monday 9th, a member of the finance team reported that an invoice had been paid to a bank account that was not the supplier\'s. The supplier confirms they never sent the revised details. The payment was approved on Thursday 5th on the basis of an emailed request appearing to come from the supplier\'s usual contact.\n\n' +
          'You have been authorised to investigate: what happened, whether anything else was affected, and what should change. Your authority covers company systems and company email accounts. It does not cover personal devices or personal accounts.\n\n' +
          'YOUR QUESTION, written plainly: how did a fraudulent bank-detail change come to be accepted, what else did the person responsible have access to, and what would have prevented it?\n\n' +
          'Over the next lessons you will receive the evidence package in stages, mirroring how evidence genuinely arrives - incomplete, in the wrong order, and with pieces that turn out not to matter.',
      },
      {
        lessonId: 'garud-m17-l02',
        title: '17.2 The Evidence Package',
        duration: '26 mins',
        subject: 'CYBERSECURITY',
        summary: 'The material available to you, with its gaps stated honestly.',
        content:
          'EMAIL GATEWAY LOG (UTC):\n' +
          '  Tue 3rd 11:02 inbound from accounts@meridian-tutorials.co (note the domain) to r.iyer@meridiantutorials.com, subject "Updated bank details - invoice 4471"\n' +
          '  Tue 3rd 11:47 r.iyer opened the message; link in message followed at 11:49\n' +
          '  Thu 5th 09:14 outbound from r.iyer to finance approving the change\n\n' +
          'AUTHENTICATION LOG (UTC):\n' +
          '  Tue 3rd 11:52 OK r.iyer from 198.51.100.23 (not a previously seen address)\n' +
          '  Tue 3rd 11:52 OK r.iyer from 10.2.4.88 (office)\n' +
          '  Wed 4th 02:31 OK r.iyer from 198.51.100.23\n' +
          '  Wed 4th 02:33 MAILBOX RULE CREATED by r.iyer: move messages containing "invoice" to Archive, mark read\n\n' +
          'FINANCE SYSTEM LOG (UTC+5:30, clock verified):\n' +
          '  Thu 5th 15:40 supplier 4471 bank details changed, user=finance.ops, approval reference cites r.iyer email\n' +
          '  Thu 5th 16:02 payment released, supplier 4471\n\n' +
          'WHAT IS NOT AVAILABLE. There is no web proxy logging, so the destination of the 11:49 link is unknown. Endpoint logs were retained for seven days and the workstation was rebuilt on the 10th before anyone thought to image it. There is no MFA on email.\n\n' +
          'Read the gaps as carefully as the entries. Several of the questions you will be asked can only be answered with "not determinable, because" - and saying so precisely is part of the work.',
      },
      {
        lessonId: 'garud-m17-l03',
        title: '17.3 Working the Case: Method',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'Applying the whole stage: timeline, indicators, attribution and its limits.',
        content:
          'Approach this in the order the stage has taught, not in the order the evidence is printed.\n\n' +
          'Normalise the timeline first. Two of the three sources are in UTC and one is not, and the finance system\'s entries will land in the wrong place if you skip this. Getting the order wrong makes a coherent and completely incorrect story.\n\n' +
          'Identify indicators. The lookalike domain, the unfamiliar source address, the mailbox rule, and the timing of the 02:31 login are each individually weak and jointly strong. Note specifically what the mailbox rule achieves - ask why an attacker would want invoice messages hidden from the account\'s owner.\n\n' +
          'Be disciplined about attribution. The evidence shows actions taken using r.iyer\'s credentials. It does not show who was at a keyboard. Those are different claims, and the difference matters enormously to a person whose job may depend on your report.\n\n' +
          'Then ask the counterfactual: which single control, had it been present, would most likely have stopped this? That question is what turns an investigation into a recommendation.',
      },
    ],
    quizzes: [],
    tasks: [
      {
        taskId: 'garud-m17-a01',
        title: 'Capstone Part 1 — Evidence and Timeline',
        type: 'Activity',
        subject: 'CYBERSECURITY',
        urgency: 'high',
        pointsReward: 80,
        dueOffsetDays: 14,
        iconName: 'ListOrdered',
        description:
          'Steps 1-5 of the capstone investigation, using only the supplied evidence package.\n\n' +
          '1. UNDERSTAND THE CASE. State the question you are answering in one or two sentences, and state the limits of your authority.\n' +
          '2. IDENTIFY EVIDENCE. List every item in the package, what it is, and what it could establish. Then list what is missing and why it is missing.\n' +
          '3. ANALYSE. For each item, state what it shows and your confidence in it.\n' +
          '4. IDENTIFY INDICATORS. List every indicator of compromise you can find, and explain why each is an indicator rather than an ordinary event. Explain what the mailbox rule was for.\n' +
          '5. BUILD A TIMELINE. A single normalised timeline stating the timezone chosen, each entry carrying its source. Mark gaps explicitly rather than closing over them.\n\n' +
          'Assessed on: correct timezone reconciliation, whether indicators are justified rather than listed, whether the timeline is factual with interpretation kept out of it, and whether missing evidence is identified as precisely as present evidence.',
      },
      {
        taskId: 'garud-m17-a02',
        title: 'Capstone Part 2 — Findings, Report and Defence',
        type: 'Activity',
        subject: 'CYBERSECURITY',
        urgency: 'high',
        pointsReward: 90,
        dueOffsetDays: 21,
        iconName: 'ScrollText',
        description:
          'Steps 6-8 of the capstone investigation, building on Part 1.\n\n' +
          '6. DOCUMENT FINDINGS. State what happened, in sequence, with each claim traceable to a specific evidence item. Separate explicitly: what the evidence shows, what you infer, and what you were told. State what you could not determine and exactly why - including the consequence of the workstation being rebuilt before imaging.\n' +
          '7. PREPARE THE FINAL REPORT. A complete report with: a one-page summary for a non-technical reader; detailed findings with confidence levels; an attribution statement that is precise about the difference between an account being used and a person acting; and ranked recommendations, each naming the control and what it would have prevented. At least one recommendation must address the seven-day retention and the absence of proxy logging.\n' +
          '8. PRESENT AND DEFEND. A five-minute presentation plus written answers to these three questions: "Are you saying r.iyer did this?"; "Why can you not tell us whether other data was taken?"; "We cannot afford all your recommendations - which one first, and why?"\n\n' +
          'Assessed on: whether the summary would lead a manager to a sound decision alone, whether attribution is handled carefully, whether the limits of the evidence are stated rather than glossed, and whether the recommendations follow from the findings rather than being generic good practice.',
      },
    ],
  },

  {
    moduleId: 'garud-m18',
    title: 'Month 9 · GARUD Final Assessment',
    order: 18,
    subject: 'CYBERSECURITY',
    lessons: [
      {
        lessonId: 'garud-m18-l01',
        title: '18.1 What the Final Assessment Covers',
        duration: '18 mins',
        subject: 'ENGLISH',
        summary: 'How the stage is assessed across all three subjects, and how to prepare.',
        content:
          'The final assessment covers the whole stage rather than the most recent month, and it deliberately spans all three subjects - because the work GARUD prepares you for does too.\n\n' +
          'Communication: structuring a point, distinguishing evidence from inference, writing for a reader who must decide something, and explaining a technical finding as a consequence.\n\n' +
          'Computer: operating system concepts, users and permissions, file systems, spreadsheets and data structure, and reading what a machine is doing.\n\n' +
          'Cybersecurity: the CIA triad and its trade-offs, authentication versus authorization, threats and vulnerabilities, network and endpoint defence, forensic principles, and security operations.\n\n' +
          'Question types are mixed. Some are objective and test recall. Some present a scenario and ask what you would conclude or do, where more than one answer is defensible and the reasoning is what counts.\n\n' +
          'The most effective preparation is to revisit your own assignments and ask what you would now do differently. The stage is designed so that each month\'s work is visible in the next.',
      },
    ],
    quizzes: [
      {
        quizId: 'garud-final-assessment',
        title: 'GARUD Final Assessment',
        subject: 'CYBERSECURITY',
        timeLimitMins: 45,
        pointsReward: 200,
        questions: [
          {
            questionId: 'q1',
            question: 'A report states: "the account was used to copy the files". Why is this phrasing preferred over "the user copied the files"?',
            options: [
              'It is shorter',
              'It states what the evidence shows without asserting who was at the keyboard',
              'It avoids naming the system',
              'It is required by law',
            ],
            correctIndex: 1,
            explanation:
              'Evidence of credential use is not evidence of who used them. The distinction matters enormously to a person whose job may depend on the report.',
          },
          {
            questionId: 'q2',
            question: 'Two logs must be correlated; one server\'s clock is eleven minutes fast. What is the consequence if this goes undetected?',
            options: [
              'Some entries will be missing',
              'The reconstructed sequence will be wrong while appearing entirely convincing',
              'The logs cannot be opened',
              'Hash verification will fail',
            ],
            correctIndex: 1,
            explanation:
              'Clock skew produces a coherent and incorrect story - the most dangerous kind of error, because nothing about it looks wrong.',
          },
          {
            questionId: 'q3',
            question: 'Which of these is a configuration weakness rather than a software vulnerability?',
            options: [
              'A buffer overflow in a PDF reader',
              'An administrative interface reachable from the internet with a default password',
              'A flaw in a cryptographic library',
              'An injection flaw in a web application',
            ],
            correctIndex: 1,
            explanation:
              'The software is working as designed; it was deployed badly. Configuration accounts for a larger share of real incidents than people expect.',
          },
          {
            questionId: 'q4',
            question: 'A spreadsheet column mixes "12", "twelve" and "about 12". What breaks first?',
            options: [
              'The file will not save',
              'Sorting, filtering and any calculation downstream',
              'The column header',
              'Nothing - spreadsheets handle this automatically',
            ],
            correctIndex: 1,
            explanation:
              'Every row must mean the same kind of thing and every column the same kind of fact. Validation at entry prevents this; cleaning afterwards costs hours and introduces errors.',
          },
          {
            questionId: 'q5',
            question: 'An organisation has a flat network. A single laptop is compromised. Why is this disproportionately serious?',
            options: [
              'Flat networks are slower',
              'The foothold can reach every server and database directly, so the first compromise is effectively the whole environment',
              'Flat networks cannot be monitored',
              'It prevents the use of firewalls',
            ],
            correctIndex: 1,
            explanation:
              'Segmentation exists for containment. Most damaging incidents involve lateral movement that segmentation would have slowed or stopped.',
          },
          {
            questionId: 'q6',
            question: 'A process running as a standard user is compromised. Why does this matter less than the same flaw in a process running as administrator?',
            options: [
              'Standard users cannot run programs',
              'What an attacker can do depends on the identity the process runs as, so least privilege limits the reach of the foothold',
              'Administrator processes are always monitored',
              'It does not matter - both are equally serious',
            ],
            correctIndex: 1,
            explanation:
              'The kernel decides what may happen by asking who is asking. Least privilege is why a compromised application is not automatically a compromised machine.',
          },
          {
            questionId: 'q7',
            question: 'You find one log entry that contradicts your conclusion. What should the report do?',
            options: [
              'Omit it, since it is a single outlier',
              'Present it alongside the supporting evidence and address it',
              'Change the conclusion to match that entry',
              'Note it privately but leave it out of the written report',
            ],
            correctIndex: 1,
            explanation:
              'A report that acknowledges contradicting evidence is more credible, and if a reader finds an omission themselves, everything else you wrote comes into question.',
          },
          {
            questionId: 'q8',
            question: 'Password spraying tries one common password across many accounts. Why does per-account lockout fail to detect it?',
            options: [
              'Lockout only applies to administrators',
              'No single account sees repeated failures, so nothing crosses the threshold',
              'Spraying uses encrypted traffic',
              'Lockout thresholds reset daily',
            ],
            correctIndex: 1,
            explanation:
              'It is designed specifically to evade lockout. Detection requires looking across accounts for a pattern of single failures - which is why it succeeds against organisations monitoring only per-account.',
          },
          {
            questionId: 'q9',
            question: 'A site uses HTTPS with a valid certificate and asks for your banking password. What has the certificate established?',
            options: [
              'That the site is legitimate',
              'That the connection is encrypted and the server holds a certificate for that domain - nothing about its intent',
              'That the site has been audited',
              'That the password will be stored securely',
            ],
            correctIndex: 1,
            explanation:
              'Most phishing sites now have valid certificates. TLS proves who you are talking to for that domain, not that they deserve your trust.',
          },
          {
            questionId: 'q10',
            question: 'An investigation cannot determine whether data was exfiltrated because logs were kept for seven days. How should the report handle this?',
            options: [
              'Omit the question, since it cannot be answered',
              'State it as a finding: what could not be determined, and why',
              'Assume no exfiltration occurred',
              'Assume exfiltration occurred to be safe',
            ],
            correctIndex: 1,
            explanation:
              '"We could not determine X, because Y" is a finding and often an important one. Reporting only successes implies a completeness the investigation does not have.',
          },
          {
            questionId: 'q11',
            question: 'A mailbox rule is created that moves all messages containing "invoice" to Archive and marks them read. What is the most likely purpose?',
            options: [
              'Reducing inbox clutter for the user',
              'Hiding supplier and finance correspondence from the account\'s owner so the fraud is not noticed',
              'Improving mail server performance',
              'Backing up invoices automatically',
            ],
            correctIndex: 1,
            explanation:
              'Ask what the rule achieves. Concealing exactly the correspondence that would reveal the fraud is a recognised step in business email compromise.',
          },
          {
            questionId: 'q12',
            question: 'Which single control would most likely have prevented a fraudulent bank-detail change approved from a compromised mailbox?',
            options: [
              'Longer password requirements',
              'Out-of-band verification of bank-detail changes through a known phone number',
              'A faster antivirus scanner',
              'More frequent password rotation',
            ],
            correctIndex: 1,
            explanation:
              'Verifying through a channel you chose, rather than one the message supplied, defeats the attack even when the mailbox is genuinely compromised.',
          },
          {
            questionId: 'q13',
            question: 'You are asked to soften a finding before a report goes to the board. Where is the line?',
            options: [
              'All changes are improper once a report is written',
              'Adjusting how something is communicated is legitimate; changing what is reported as true is not',
              'Any change requested by management is acceptable',
              'Findings may be removed if they are only "likely" rather than confirmed',
            ],
            correctIndex: 1,
            explanation:
              'Presentation is negotiable; the facts are not. The test worth holding is whether you would be comfortable with the decision and your reasoning being known.',
          },
          {
            questionId: 'q14',
            question: 'Anomaly-based detection flags a departure from baseline. What makes the baseline itself hard to establish?',
            options: [
              'Baselines require specialised hardware',
              'It must be built before the incident, and an environment already compromised bakes the compromise into "normal"',
              'Baselines expire after 24 hours',
              'Only encrypted traffic can be baselined',
            ],
            correctIndex: 1,
            explanation:
              'Establishing what normal looks like is most of the work and must be done in advance - during an incident is too late, and a compromised environment normalises the intrusion.',
          },
          {
            questionId: 'q15',
            question: 'Which statement about a hash is correct?',
            options: [
              'It is encryption that can be reversed with the right key',
              'The same input always produces the same output, any change produces a different one, and it cannot be reversed',
              'It compresses a file so it can be restored later',
              'It is unique to the machine that computed it',
            ],
            correctIndex: 1,
            explanation:
              'Those three properties are what make it an integrity check. It is not encryption - there is no key and nothing to decrypt.',
          },
        ],
      },
    ],
    tasks: [
      {
        taskId: 'garud-final-capstone',
        title: 'GARUD Final Capstone — Digital Investigation and Professional Presentation',
        type: 'Activity',
        subject: 'CYBERSECURITY',
        urgency: 'high',
        pointsReward: 250,
        dueOffsetDays: 28,
        iconName: 'Award',
        description:
          'The final piece of GARUD. It combines your month 9 investigation with the communication standard of month 7, and it is assessed as one body of work.\n\n' +
          'SUBMIT THREE THINGS.\n\n' +
          'ONE - The investigation dossier. Your complete work on the Meridian Tutorials case: the normalised timeline, the indicators with justification, the findings with confidence levels, and an explicit statement of what could not be determined and why. Every claim traceable to an evidence item.\n\n' +
          'TWO - The professional report. A standalone document a manager could act on without reading the dossier. One-page summary, findings, a carefully worded attribution statement, and ranked recommendations each naming what it would have prevented. Written for a reader with no technical background, without becoming vague.\n\n' +
          'THREE - The presentation and defence. A recorded or delivered presentation of no more than eight minutes, plus written answers to the three challenge questions from Part 2. Your presentation must open with the conclusion, use the timeline as its spine, show one pivotal piece of evidence, and end with a specific decision you are asking for.\n\n' +
          'ASSESSED ACROSS ALL THREE SUBJECTS. Cybersecurity: the soundness of the analysis and the recommendations. Computer: correct reading of logs, timestamps, systems and accounts. English: whether the report and presentation would actually work on their intended audience.\n\n' +
          'The standard is not whether you found the right answer - the case is designed so that parts of it cannot be answered. It is whether your reasoning is sound, your evidence is handled honestly, and someone could act on what you produced.',
      },
    ],
  },
];

export default MASTERY;
