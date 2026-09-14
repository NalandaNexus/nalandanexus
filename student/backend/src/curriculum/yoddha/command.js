/**
 * YODDHA, months 1-3: communication under real pressure, systems at depth, and
 * networking as something you design rather than describe.
 *
 * The step up from GARUD is deliberate. GARUD asked what something is; YODDHA
 * asks what you would do about it, with the ambiguity left in.
 */

export const COMMAND = [
  {
    moduleId: 'yoddha-m01',
    title: 'Month 1 · Advanced Professional Communication',
    order: 1,
    subject: 'ENGLISH',
    lessons: [
      {
        lessonId: 'yoddha-m01-l01',
        title: '1.1 Executive Communication',
        duration: '24 mins',
        subject: 'ENGLISH',
        summary: 'Writing and speaking for people who decide, and have very little time.',
        content:
          'Senior audiences are not less intelligent than technical ones - they are differently constrained. They have minutes, they are deciding between things you may not know about, and they need consequence rather than mechanism.\n\n' +
          'Lead with the decision you want and its implication. "I am asking for approval to take the payment system offline for four hours on Sunday; without it, we remain exposed to the vulnerability disclosed last week." Everything else is supporting material.\n\n' +
          'Give the shape of the risk in terms they already use: money, time, obligation, reputation, ability to operate. A vulnerability score means nothing to a finance director; "if exploited, customer records are readable, which is a reportable breach" means a great deal.\n\n' +
          'Offer options with a recommendation, not a menu. Presenting three choices and declining to advise pushes a technical judgement onto someone not equipped to make it, and they know it.\n\n' +
          'Be brief in a way that survives questions. The brief version must be true, not merely short - a simplification you would have to retract under questioning is worse than the longer honest version.',
      },
      {
        lessonId: 'yoddha-m01-l02',
        title: '1.2 Persuasive Communication',
        duration: '24 mins',
        subject: 'ENGLISH',
        summary: 'Changing what people do, honestly, when you have no authority to instruct them.',
        content:
          'Most of the security changes you will want are ones you cannot order. Persuasion is the working skill.\n\n' +
          'Start from their objective, not yours. A team resisting a control usually has a legitimate reason - it slows their delivery, it breaks a workflow, it was imposed without consultation. Addressing the actual objection works; repeating your case louder does not.\n\n' +
          'Make the cost of inaction concrete and near. Distant, diffuse risk loses to immediate, specific cost every time. "This is how the account takeover last quarter happened, and this control would have stopped it" beats an abstract argument about likelihood.\n\n' +
          'Reduce what you are asking for. A smaller first step that succeeds builds far more than a comprehensive proposal that is declined.\n\n' +
          'And stay honest. Overstating risk to win an argument works once; afterwards your assessments are discounted permanently, including the ones that are urgent. Credibility is the only durable persuasive asset a security practitioner has.',
      },
      {
        lessonId: 'yoddha-m01-l03',
        title: '1.3 Technical Storytelling',
        duration: '22 mins',
        subject: 'ENGLISH',
        summary: 'Using narrative structure to make a technical sequence comprehensible.',
        content:
          'People remember sequences of events far better than lists of facts. A technical narrative uses that without sacrificing accuracy.\n\n' +
          'The structure is the one an investigation naturally has: this was the situation, this happened, this is what it led to, this is where we are now. It maps onto a timeline, which you already build.\n\n' +
          'Anchor it in something concrete. "An email arrived at 11:02 on Tuesday" gives the listener a place to stand; "an initial access vector was observed" does not, though they mean the same thing.\n\n' +
          'Keep the cast small. Naming seven systems and four accounts loses the audience by the third. Name the two that matter and refer to the rest by role.\n\n' +
          'The discipline is that narrative must not add causation the evidence does not support. It is very easy, while telling a good story, to say "and then the attacker moved to the file server" when the evidence shows only that a connection occurred. Story is a delivery mechanism, not a licence.',
      },
      {
        lessonId: 'yoddha-m01-l04',
        title: '1.4 Handling Difficult Questions',
        duration: '22 mins',
        subject: 'ENGLISH',
        summary: 'Questions designed to trap, to blame, or to extract a commitment you cannot make.',
        content:
          'Some questions are asked to understand. Others are asked to establish blame, to extract a guarantee, or to get you to agree to something in front of witnesses. Recognising which you are facing changes the answer.\n\n' +
          'The false-choice question - "so is the system secure or not?" - is best answered by rejecting the frame honestly: "Security is not binary. Against the specific risk you are asking about, here is where we stand." Answering yes or no to that question is a trap in either direction.\n\n' +
          'The guarantee question - "can you promise this will not happen again?" - cannot be answered honestly with yes. Answer what you can commit to: the controls implemented, what they address, and what residual risk remains.\n\n' +
          'The blame question - "whose fault was this?" - should be redirected to cause without protecting anyone dishonestly. "The change was made without review because the review step is not enforced by the system" is both true and more useful than a name.\n\n' +
          'Throughout: answer the substance, decline the framing, never accept a premise you believe is false merely because the room is uncomfortable.',
      },
      {
        lessonId: 'yoddha-m01-l05',
        title: '1.5 Interview Communication',
        duration: '22 mins',
        subject: 'ENGLISH',
        summary: 'Describing your own work credibly, including the parts that went wrong.',
        content:
          'A technical interview is largely an assessment of how you think, conducted through what you have done.\n\n' +
          'Describe work as situation, your specific action, and outcome. The most common failure is describing what a team did without ever saying what you did - which reads as either dishonesty or a small contribution being concealed.\n\n' +
          'Be precise about scale and your part in it. "I built the reporting system" and "I wrote the data-validation layer of the reporting system, which four of us built" differ, and the second is more impressive to anyone experienced, because it is credible.\n\n' +
          'Have a real example of something that went wrong, what you learned and what you changed. Candidates who have never failed at anything are understood to be either inexperienced or not being candid.\n\n' +
          'When you do not know something, say so and then say how you would find out. In security specifically, "I have not worked with that; here is how I would approach it" is a strong answer, because the field guarantees you will meet unfamiliar things.',
      },
      {
        lessonId: 'yoddha-m01-l06',
        title: '1.6 High-Pressure Communication',
        duration: '24 mins',
        subject: 'ENGLISH',
        summary: 'Communicating during a live incident, when facts are incomplete and changing.',
        content:
          'During an incident, communication is itself part of the response, and it is done with facts that are incomplete and will change.\n\n' +
          'Separate confirmed from suspected in every update, explicitly. "Confirmed: one workstation compromised. Suspected but unconfirmed: credentials for the finance system." Blurring these is how a suspicion becomes an organisational fact and drives a decision it should not have.\n\n' +
          'Update on a schedule, even when there is nothing new. "No change since the last update, next update at 16:00" prevents the information vacuum that people otherwise fill with speculation - and stops the stream of individual questions that consume the responders.\n\n' +
          'Say what you do not yet know, and when you expect to know it. An update that only reports progress implies the unmentioned areas are fine.\n\n' +
          'Keep one written record everyone works from. Parallel conversations produce divergent understandings, and at the point of a decision those divergences surface in the worst possible way.\n\n' +
          'Correct errors immediately and visibly. An uncorrected wrong fact propagates fast during an incident.',
      },
    ],
    quizzes: [],
    tasks: [
      {
        taskId: 'yoddha-m01-a01',
        title: 'Professional Technical Briefing',
        type: 'Task',
        subject: 'ENGLISH',
        urgency: 'high',
        pointsReward: 70,
        dueOffsetDays: 14,
        iconName: 'Speech',
        description:
          'Brief a non-technical executive on a real technical situation, then handle the questions.\n\n' +
          'SCENARIO. A vulnerability has been disclosed in software your organisation uses for customer records. It is exploitable remotely, a patch exists, and applying it requires four hours of downtime. The only window that avoids disrupting customers is Sunday. Your finance director must approve the downtime, and does not know what a vulnerability is.\n\n' +
          'Produce:\n' +
          '1. A written brief of no more than 300 words. It must open with the decision you are asking for, express the risk in terms of consequence rather than mechanism, and state what happens if the answer is no.\n' +
          '2. A recommendation, not a menu of options - and say why you recommend it over the alternative.\n' +
          '3. Written answers to these three questions, which you will be asked: "Can you guarantee this will not happen again?"; "Is our system secure or not?"; "Why did nobody notice this earlier?"\n\n' +
          'Assessed on: whether a non-technical reader would understand what is at stake and be able to decide; whether your simplifications are true rather than merely short; and whether your three answers decline the unfair framings without being evasive.',
      },
    ],
  },

  {
    moduleId: 'yoddha-m02',
    title: 'Month 1 · Leadership & Ethics',
    order: 2,
    subject: 'ENGLISH',
    lessons: [
      {
        lessonId: 'yoddha-m02-l01',
        title: '2.1 Security Leadership',
        duration: '22 mins',
        subject: 'ENGLISH',
        summary: 'Leading a function whose success is invisible and whose failure is not.',
        content:
          'Security leadership has a structural difficulty: when it works, nothing happens, and nothing is hard to take credit for. When it fails, the failure is highly visible and frequently public.\n\n' +
          'That shapes the job in three ways. You must make the invisible legible - reporting what was prevented, what was detected, how quickly, and what the trend is, so that the function is understood as producing something.\n\n' +
          'You must resist the temptation to manufacture visibility through alarm. A leader who escalates everything gets attention initially and is discounted afterwards.\n\n' +
          'And you must accept that your recommendations will sometimes be declined by people entitled to decline them. Your job is to make the risk clear and the decision informed, not to win. Recording the decision and its acceptance is the appropriate response - not resentment, and not silence.\n\n' +
          'The team you lead sees all of this. How you handle a declined recommendation teaches them more about the organisation than any policy document.',
      },
      {
        lessonId: 'yoddha-m02-l02',
        title: '2.2 Ethical Decision Making',
        duration: '24 mins',
        subject: 'ENGLISH',
        summary: 'Working through the cases where two legitimate obligations conflict.',
        content:
          'Easy ethical questions are not the ones you will face. The hard cases are where two genuine obligations conflict.\n\n' +
          'You discover, during an authorised investigation, evidence of something unrelated and serious. Your obligation to the scope of your authority conflicts with an obligation not to ignore what you saw. The usual resolution is to report the existence of a concern through the proper channel without having gone further into it yourself - but the point is to recognise the conflict rather than resolve it by instinct.\n\n' +
          'You are asked to delay a disclosure until after a funding round. Delay may be reasonable for coordinated remediation and unreasonable if the motive is purely commercial and users remain exposed.\n\n' +
          'You find a flaw caused by your own earlier work. The obligation to report conflicts with self-interest, and this is the one where people most often fail.\n\n' +
          'A workable method: name the obligations in conflict, identify who is harmed under each course, consider whether you would be comfortable with your reasoning being known, and consult someone before acting when it is genuinely close.',
      },
      {
        lessonId: 'yoddha-m02-l03',
        title: '2.3 Professional Responsibility',
        duration: '22 mins',
        subject: 'ENGLISH',
        summary: 'What you owe to users, colleagues and the profession when nobody is checking.',
        content:
          'Technical professionals hold responsibilities that nobody enforces day to day. The work is mostly unobserved, and much of it could be done badly without immediate detection.\n\n' +
          'To users: they cannot evaluate your decisions and have no realistic choice but to trust them. A default you set carelessly affects thousands of people who will never know it was a decision.\n\n' +
          'To colleagues: not leaving hazards behind. Undocumented systems, credentials in code, and controls disabled "temporarily" are all transfers of risk to whoever comes next.\n\n' +
          'To the profession: not claiming expertise you lack. Security advice from someone out of their depth is worse than no advice, because it is acted upon.\n\n' +
          'The recurring test is what you do when a shortcut would not be noticed. Disabling certificate verification to make something work, leaving a test account active, granting broad permissions because narrowing them is slow - each is invisible now and each is exactly how the incidents you studied in GARUD began.',
      },
      {
        lessonId: 'yoddha-m02-l04',
        title: '2.4 Team Leadership',
        duration: '22 mins',
        subject: 'ENGLISH',
        summary: 'Building a team that reports problems early rather than concealing them.',
        content:
          'The single most valuable property of a security team is that people tell you bad news quickly. Everything else is downstream of that.\n\n' +
          'It is built and destroyed by how the first bad news is received. A person who reports their own mistake and is punished teaches everyone watching to conceal; the concealment is not discovered, so the lesson appears to work.\n\n' +
          'Respond to a reported mistake by fixing the situation first and examining the system afterwards. "How did the process allow this?" produces information; "why did you do that?" produces defensiveness.\n\n' +
          'Distinguish honest error from negligence and from dishonesty. They are genuinely different and treating them identically in either direction is corrosive - tolerating dishonesty destroys trust, and punishing honest error destroys reporting.\n\n' +
          'Give people the whole problem where you can. Security work becomes tedious when split into fragments nobody owns, and tedium produces exactly the inattention the work cannot afford.',
      },
      {
        lessonId: 'yoddha-m02-l05',
        title: '2.5 Crisis Communication',
        duration: '24 mins',
        subject: 'ENGLISH',
        summary: 'Communicating outward during a serious incident, including to people who are affected.',
        content:
          'Crisis communication is the outward face of incident response, and it is judged mostly on honesty and speed rather than polish.\n\n' +
          'Acknowledge early, even with little information. "We are aware of an issue affecting X, we are investigating, next update at a stated time" is far better than silence. Silence is interpreted as either incompetence or concealment, and neither is recoverable cheaply.\n\n' +
          'Never speculate publicly about scope. An early "we believe only a small number of accounts are affected" that later proves wrong is remembered as a lie, whatever the intent. Say what is confirmed, and say that scope is being established.\n\n' +
          'Tell affected people what they should actually do. A notification that describes an incident without telling a user whether to change a password has served the organisation, not them.\n\n' +
          'Be aware of obligations. Many jurisdictions impose notification requirements with deadlines, and those are legal questions requiring legal input - your responsibility is to raise them early, not to decide them.\n\n' +
          'One voice, one record. Multiple people communicating independently will contradict each other, and the contradiction becomes the story.',
      },
      {
        lessonId: 'yoddha-m02-l06',
        title: '2.6 Accountability',
        duration: '22 mins',
        subject: 'ENGLISH',
        summary: 'Owning outcomes without blame, and making review produce change.',
        content:
          'Accountability is owning an outcome and doing something about it. It is not the same as blame, and organisations that confuse them get neither.\n\n' +
          'A blameless review asks how the system allowed the outcome. It is not a claim that nobody made a mistake - people make mistakes constantly, and a system that only works when nobody does is already broken. The question is what made the mistake possible and undetected.\n\n' +
          'A review that ends in "be more careful" has failed. That is not a change; it is a wish. Real outcomes are a check added, a permission narrowed, a step automated, a piece of information made visible.\n\n' +
          'Reviews must produce owned actions with dates, and those must be followed up. Unactioned review findings are how the same incident recurs with a fuller paper trail.\n\n' +
          'Leaders go first. A leader who publicly examines their own decision - what they knew, what they would now do differently - makes it possible for everyone else. One who never does makes the whole exercise theatre, and everybody knows it.',
      },
    ],
    quizzes: [
      {
        quizId: 'yoddha-m02-q01',
        title: 'Leadership and Professional Ethics',
        subject: 'ENGLISH',
        timeLimitMins: 15,
        pointsReward: 60,
        questions: [
          {
            questionId: 'q1',
            question: 'A team member reports their own mistake and is publicly reprimanded. What is the predictable effect on the team?',
            options: [
              'Fewer mistakes, because people become more careful',
              'Concealment - and because concealment is not discovered, the approach appears to work',
              'No effect, provided the reprimand is fair',
              'Improved reporting, because standards are now clear',
            ],
            correctIndex: 1,
            explanation:
              'The most valuable property of a security team is that bad news travels fast. It is built or destroyed by how the first report is received, and the resulting silence is invisible.',
          },
          {
            questionId: 'q2',
            question: 'You are asked to delay disclosing a vulnerability until after a funding round. When is that legitimate?',
            options: [
              'Always - commercial timing is a valid business consideration',
              'Never - disclosure must always be immediate',
              'When the delay serves coordinated remediation; not when users remain exposed purely for commercial convenience',
              'Only if a lawyer approves it',
            ],
            correctIndex: 2,
            explanation:
              'Naming the obligations in conflict is the method. Delay for remediation protects users; delay purely for commercial reasons leaves them exposed while the reason is not theirs.',
          },
          {
            questionId: 'q3',
            question: 'A review of an incident produces the action "staff should be more careful". Why is this inadequate?',
            options: [
              'It is too short',
              'It is a wish, not a change - it adds no check, narrows no permission and makes nothing visible',
              'It should be directed at management instead',
              'Reviews should not produce actions',
            ],
            correctIndex: 1,
            explanation:
              'A system that only works when nobody makes a mistake is already broken. Real outcomes are structural, owned and dated.',
          },
          {
            questionId: 'q4',
            question: 'You delegate a piece of work but require your approval for every decision within it. What have you actually done?',
            options: [
              'Delegated responsibly with appropriate oversight',
              'Transferred responsibility without authority, which is supervision with extra steps',
              'Transferred accountability as well as responsibility',
              'Applied separation of duties',
            ],
            correctIndex: 1,
            explanation:
              'Delegation means the outcome plus the authority to make the decisions it needs. Accountability, separately, does not transfer at all.',
          },
          {
            questionId: 'q5',
            question: 'During a security incident, an executive asks for continuous updates from the responders. What should the incident lead do?',
            options: [
              'Pass the requests to the responders so information flows freely',
              'Absorb the demand and brief on a schedule, so responders are not consumed by reporting',
              'Decline to provide updates until the incident is resolved',
              'Ask the executive to join the technical calls',
            ],
            correctIndex: 1,
            explanation:
              'Unmanaged, that demand consumes exactly the people meant to be fixing the problem. Scheduled briefing serves leadership properly and protects the response.',
          },
          {
            questionId: 'q6',
            question: 'You discover a serious flaw caused by your own earlier work. What does professional responsibility require?',
            options: [
              'Fix it quietly, since you are correcting your own error',
              'Report it through the same process as any other finding',
              'Report it only if it is exploited',
              'Raise it anonymously',
            ],
            correctIndex: 1,
            explanation:
              'This is the conflict where people most often fail, because the obligation to report runs directly against self-interest.',
          },
        ],
      },
    ],
    tasks: [],
  },

  {
    moduleId: 'yoddha-m03',
    title: 'Month 2 · Advanced Operating Systems',
    order: 3,
    subject: 'COMPUTER',
    lessons: [
      {
        lessonId: 'yoddha-m03-l01',
        title: '3.1 Processes in Depth',
        duration: '24 mins',
        subject: 'COMPUTER',
        summary: 'Process creation, identity and the relationships that reveal intrusions.',
        content:
          'GARUD introduced processes as running programs. Here the detail matters, because it is what makes an intrusion visible.\n\n' +
          'A process is created by another process, inheriting an environment, a working directory, open file handles and - critically - an identity. That inheritance is why a shell spawned by a compromised service runs with the service\'s privileges rather than the attacker\'s.\n\n' +
          'Each process has an image on disk, a command line it was started with, a parent, and an owner. The command line frequently carries the most information in an investigation, because it shows what was actually asked for, including arguments that reveal intent.\n\n' +
          'Unusual relationships are the strongest signal. A database process spawning a shell; a browser spawning a scripting interpreter; anything spawned by a service that normally spawns nothing. None of these are suspicious as individual processes and all of them are suspicious as relationships.\n\n' +
          'Processes can also be manipulated - injected into, hollowed out and replaced - which is why a legitimate process name is not evidence of legitimate behaviour.',
      },
      {
        lessonId: 'yoddha-m03-l02',
        title: '3.2 Memory',
        duration: '22 mins',
        subject: 'COMPUTER',
        summary: 'Virtual memory, isolation, and why memory is such valuable evidence.',
        content:
          'Each process sees its own private address space. The operating system maps that virtual space onto physical memory, and this is the mechanism that keeps processes from reading each other.\n\n' +
          'That isolation is a security boundary of the same kind as the kernel boundary. Breaking it - reading another process\'s memory, writing into it - is what memory-corruption attacks are for.\n\n' +
          'Memory holds things that exist nowhere else: decrypted data, credentials in use, keys, network buffers, and the code of programs that never touched the disk. Malware that runs only in memory leaves no file to find, which is exactly why it is used.\n\n' +
          'This is why memory is collected first in an investigation and why it is so valuable. It is also why it is fragile - it is gone at power-off, and it changes continuously while the machine runs, including while you collect it.\n\n' +
          'Swap complicates this usefully: memory paged to disk can persist after shutdown, which occasionally preserves evidence that was supposed to be volatile.',
      },
      {
        lessonId: 'yoddha-m03-l03',
        title: '3.3 Services and Persistence',
        duration: '24 mins',
        subject: 'COMPUTER',
        summary: 'Background services, startup mechanisms, and how attackers survive a reboot.',
        content:
          'Services are programs that run without a logged-in user, starting at boot and running with system privileges. That combination makes them both essential and attractive.\n\n' +
          'Persistence is the attacker\'s requirement that access survive a restart, and the available mechanisms are the same ones legitimate software uses: registering a service, adding a startup entry, creating a scheduled task, modifying a user\'s login scripts, or replacing a binary a legitimate service loads.\n\n' +
          'Knowing the full list matters because checking only the obvious location finds only the unsophisticated. An investigation that examines startup folders and declares a machine clean has checked one of six or seven places.\n\n' +
          'The defensive question for each is: what should be here, and is anything here that should not be? That requires knowing the baseline, which is why an inventory of expected services is worth producing before you need it.\n\n' +
          'A scheduled task running an interpreter against a script in a temporary directory is not subtle - but it is only visible to someone who looked at scheduled tasks.',
      },
      {
        lessonId: 'yoddha-m03-l04',
        title: '3.4 Users, Permissions and Privilege',
        duration: '24 mins',
        subject: 'COMPUTER',
        summary: 'Privilege escalation as a concept, and the misconfigurations that enable it.',
        content:
          'Privilege escalation moves from the access you have to the access you want. Vertical escalation gains higher rights; horizontal escalation reaches another user\'s data at the same level.\n\n' +
          'The enabling conditions are overwhelmingly configuration rather than exotic exploitation. A service running with unnecessary privileges. A file or directory writable by a user when it is executed by a privileged process. A scheduled task that runs a script anyone can edit. Credentials left in a readable file. An account with administrative rights that nobody remembers creating.\n\n' +
          'Understanding these defensively tells you what to look for: writable paths in privileged execution, over-privileged service accounts, and stored credentials.\n\n' +
          'The corresponding defences are the ones you already know, applied precisely: least privilege for service accounts specifically, tight permissions on anything a privileged process reads or executes, and no credentials in files.\n\n' +
          'In investigation, escalation is usually visible as an account doing something it has never done before - which requires knowing what it normally does.',
      },
      {
        lessonId: 'yoddha-m03-l05',
        title: '3.5 System Logs at Depth',
        duration: '24 mins',
        subject: 'COMPUTER',
        summary: 'What the operating system records, what it does not by default, and tampering.',
        content:
          'Operating systems log extensively, and the default configuration is rarely what an investigator needs.\n\n' +
          'Typically recorded by default: logins and failures, service starts and stops, system errors, and some account changes. Frequently not recorded by default: process creation with command lines, file access, and detailed permission changes - which are precisely the most useful entries in an intrusion.\n\n' +
          'Enabling process-creation logging with command lines is the single highest-value logging change most organisations can make, and it is free.\n\n' +
          'Logs can be tampered with by anyone holding sufficient privilege on the machine. Deleting the whole log is crude and noticeable - the gap itself is evidence. Removing selected entries is subtler and may be detectable through sequence numbers or inconsistency with other sources.\n\n' +
          'This is why forwarding matters. A copy sent promptly to a separate system that the compromised machine cannot write to defeats all local tampering, and it is the control that converts logging from a hope into evidence.',
      },
      {
        lessonId: 'yoddha-m03-l06',
        title: '3.6 System Administration',
        duration: '22 mins',
        subject: 'COMPUTER',
        summary: 'Administering systems in a way that is reproducible and reviewable.',
        content:
          'The difference between administration and improvisation is whether the state of a system is known and reproducible.\n\n' +
          'Manual configuration produces machines that differ from each other in ways nobody has recorded. Those differences are where incidents live: the one server that was built by hand during an outage and never had the standard configuration applied.\n\n' +
          'Configuration as code makes the intended state explicit, reviewable and repeatable, and turns drift into something detectable rather than something discovered.\n\n' +
          'Changes should be made through a process that leaves a record: what changed, when, by whom, why, and how to reverse it. During an investigation, the change record is frequently the fastest route to an explanation - and its absence is frequently the reason an investigation takes a week.\n\n' +
          'Administrative access should be separate, occasional and logged. Administering from a normal working account, with a browser and email open, is the arrangement that turns one phishing click into a compromised domain.',
      },
      {
        lessonId: 'yoddha-m03-l07',
        title: '3.7 Command-Line Investigation',
        duration: '26 mins',
        subject: 'COMPUTER',
        summary: 'Interrogating a live system methodically from the command line.',
        content:
          'Investigating a live machine from the command line follows a method, not a list of commands.\n\n' +
          'Establish identity and context first: which machine, which user am I, what time does this machine think it is. That last one prevents the timeline problem before it starts.\n\n' +
          'Then the live state, in volatility order: running processes with their command lines and parents, network connections with owning processes, logged-in users, and loaded modules.\n\n' +
          'Then persistence: services, scheduled tasks, startup entries, and recently modified system locations.\n\n' +
          'Then the file system: recently modified files in temporary and user-writable locations, files with unusual permissions, and anything in a place nothing should be.\n\n' +
          'Record every command and its output as you go, with timestamps. The record is what makes your conclusions checkable, and it is also what protects you - an investigator who cannot show what they ran on a production machine is in a difficult position if something breaks afterwards.\n\n' +
          'Prefer read-only commands. Avoid anything that writes, and note it explicitly when you cannot.',
      },
    ],
    quizzes: [],
    tasks: [
      {
        taskId: 'yoddha-m03-a01',
        title: 'System Analysis Exercise',
        type: 'Activity',
        subject: 'COMPUTER',
        urgency: 'high',
        pointsReward: 80,
        dueOffsetDays: 14,
        iconName: 'Cpu',
        description:
          'A methodical live-system analysis of a machine you own, plus a reasoned assessment of supplied evidence. Use read-only commands only.\n\n' +
          'PART A - your own machine. Following the method in lesson 3.7, produce a structured report covering: identity and clock; running processes with parents and command lines for the ten most significant; network connections with owning processes; every persistence location you can enumerate (services, scheduled tasks, startup entries) and what you found in each; and recently modified files in user-writable locations.\n' +
          'For each section give the command, the output, and your interpretation. Explicitly note anything you could not check and why.\n\n' +
          'PART B - supplied evidence. Assess this process listing from another machine:\n' +
          '  PID 4412  winword.exe   parent: explorer.exe\n' +
          '  PID 4530  cmd.exe       parent: winword.exe\n' +
          '  PID 4533  powershell.exe parent: cmd.exe   cmdline: -enc <base64 string>\n' +
          '  PID 2201  svchost.exe   parent: services.exe\n' +
          '  PID 6120  svchost.exe   parent: explorer.exe\n' +
          'Identify every suspicious element, saying for each why it is suspicious as a relationship rather than as a process. Two entries here are individually ordinary and jointly alarming; one is suspicious on its own. Explain which is which.\n\n' +
          'Assessed on: whether Part A follows the method rather than listing commands, whether Part B correctly identifies both the process-chain anomaly and the parentage anomaly, and whether your reasoning distinguishes a process from its relationships.',
      },
    ],
  },

  {
    moduleId: 'yoddha-m04',
    title: 'Month 2 · Scripting & Automation',
    order: 4,
    subject: 'COMPUTER',
    lessons: [
      {
        lessonId: 'yoddha-m04-l01',
        title: '4.1 Programming Logic',
        duration: '24 mins',
        subject: 'COMPUTER',
        summary: 'Turning a procedure you can describe into one a machine can follow.',
        content:
          'A script is a procedure written precisely enough for a machine. The difficulty is rarely syntax - it is that human procedures contain assumptions the machine does not share.\n\n' +
          '"Go through the log and find the failed logins" assumes you know what a log line looks like, what counts as a failure, what to do with a malformed line, and what to do if the file is missing. A script must answer all four.\n\n' +
          'Work by writing the steps in plain language first, then making each precise. Where a step cannot be made precise, you have found the part that needs a decision rather than code.\n\n' +
          'Every program is built from sequence, selection and repetition - do this, then this; if this then that; do this for each of those. Every script you write, however complex, is those three combined.\n\n' +
          'Start from the smallest thing that works and extend it. A script written entirely before being run for the first time fails in several places at once and gives you nothing to isolate.',
      },
      {
        lessonId: 'yoddha-m04-l02',
        title: '4.2 Variables and Data',
        duration: '22 mins',
        subject: 'COMPUTER',
        summary: 'Storing values, types, and the errors that come from confusing them.',
        content:
          'A variable is a name for a value. Naming things well is not cosmetic - a script full of single-letter names is one you cannot review, and unreviewable automation is a liability.\n\n' +
          'Types matter because operations depend on them. The string "10" and the number 10 look identical and behave differently: adding 5 to one gives 15 and to the other may give "105" or an error. Log processing is full of this, since everything read from a file arrives as text and must be converted deliberately.\n\n' +
          'Collections hold many values: an ordered list, or a mapping from keys to values. Most log analysis is a list of lines transformed into a mapping of counts.\n\n' +
          'Scope decides where a name is visible. A variable defined inside a function usually does not exist outside it, which is a feature - it prevents distant parts of a script interfering with each other.\n\n' +
          'Be explicit about empty and missing. A count of zero and no data at all are different, and conflating them produces reports that quietly claim nothing happened.',
      },
      {
        lessonId: 'yoddha-m04-l03',
        title: '4.3 Conditions',
        duration: '22 mins',
        subject: 'COMPUTER',
        summary: 'Branching, combining conditions, and the edges that get missed.',
        content:
          'A condition is a question with a true or false answer, and the script takes a different path depending on which.\n\n' +
          'Conditions combine with and, or, and not. The common error is mixing them without being explicit about grouping, since "A and B or C" can mean two different things. Group explicitly rather than relying on precedence rules nobody remembers correctly.\n\n' +
          'Comparison has traps. Equality between different types may or may not convert them. Comparing text is usually case-sensitive, so "ADMIN" and "admin" differ - which matters when matching usernames in logs.\n\n' +
          'The edges are where conditions fail. If you branch on "greater than 100", decide what happens at exactly 100. If you branch on a value from a file, decide what happens when it is absent or malformed.\n\n' +
          'For anything security-relevant, prefer an explicit allow-list condition over a deny-list. Checking that input matches something known-good is robust; checking that it does not match known-bad requires you to have listed everything bad.',
      },
      {
        lessonId: 'yoddha-m04-l04',
        title: '4.4 Loops',
        duration: '22 mins',
        subject: 'COMPUTER',
        summary: 'Repetition over collections, and the failures specific to loops.',
        content:
          'Loops repeat work - over each line in a file, each file in a directory, each account in a list. Most useful automation is a loop with a condition inside it.\n\n' +
          'Prefer looping over a collection to counting. "For each line in the file" is clearer and safer than managing an index, and it eliminates the off-by-one error entirely.\n\n' +
          'Three loop-specific failures recur. An infinite loop, where the condition never becomes false - a loop whose exit depends on external state needs a maximum iteration count as well. Modifying a collection while looping over it, which produces skipped or repeated items. And accumulating into a variable that was initialised inside the loop, so it resets each time.\n\n' +
          'Performance matters at scale. A loop that reads a file once per iteration reads it ten thousand times over ten thousand lines. Read once, then loop.\n\n' +
          'When processing anything large, print progress. A script that appears frozen but is working is indistinguishable from one that has hung, and someone will kill it.',
      },
      {
        lessonId: 'yoddha-m04-l05',
        title: '4.5 Functions',
        duration: '22 mins',
        subject: 'COMPUTER',
        summary: 'Naming a piece of work so it can be reused, tested and understood.',
        content:
          'A function gives a name to a piece of work, takes inputs and returns a result. It is the main tool for keeping a script comprehensible as it grows.\n\n' +
          'The test of a good function is whether you can describe what it does in one sentence without using "and". A function that parses a line and writes to a file and sends an alert is three functions, and it cannot be tested or reused.\n\n' +
          'Functions should prefer returning a value to changing something elsewhere. A function that only returns a result can be tested by calling it and checking the answer; one that modifies shared state requires you to set up and inspect that state.\n\n' +
          'Handle bad input at the boundary. A function given something it cannot process should fail clearly rather than returning something plausible and wrong - a parser that returns zero for an unparseable line produces a report that silently understates.\n\n' +
          'Write the function before you need it twice, not after you have copied it three times. Copied code diverges, and the divergence is discovered when only one copy has the fix.',
      },
      {
        lessonId: 'yoddha-m04-l06',
        title: '4.6 File Processing',
        duration: '24 mins',
        subject: 'COMPUTER',
        summary: 'Reading, parsing and writing files without losing data or memory.',
        content:
          'Most defensive automation reads a file, transforms it, and writes a result. Doing that reliably has a few rules.\n\n' +
          'Stream large files rather than loading them. Reading a multi-gigabyte log entirely into memory fails on the day it matters; processing line by line uses a constant amount regardless of size.\n\n' +
          'Parse defensively. Real log files contain malformed lines, truncated lines, and lines in an older format from before a software upgrade. A parser that assumes a fixed number of fields will fail partway through a file, and if it fails silently you will analyse a partial dataset without knowing.\n\n' +
          'Count what you skipped and report it. "Processed 482,113 lines, skipped 27 as unparseable" is an honest result; skipping silently is how an analysis quietly excludes exactly the unusual entries you were looking for.\n\n' +
          'Never write over your input. Write to a new file, verify it, then replace if you must - because a script that fails halfway through writing over its source has destroyed the evidence.\n\n' +
          'Be explicit about encoding, and about how lines end. Files from different systems differ, and mismatches corrupt the last field of every line.',
      },
      {
        lessonId: 'yoddha-m04-l07',
        title: '4.7 Automation Concepts',
        duration: '22 mins',
        subject: 'COMPUTER',
        summary: 'Running things unattended, and knowing when they fail.',
        content:
          'Automation that runs unattended has a requirement interactive work does not: it must tell you when it fails.\n\n' +
          'The silent failure is the characteristic risk. A scheduled job that stops working produces no output, and no output looks exactly like everything being fine. Design for this: report success as well as failure, or alert on the absence of an expected success.\n\n' +
          'Scripts should be idempotent where possible - running twice should not do the work twice. Scheduled jobs overlap, get triggered manually during an incident, and are re-run after a failure. A script that appends a duplicate every time it runs will corrupt its own output.\n\n' +
          'Log what the automation did, with timestamps, to somewhere durable. When it produces a wrong result three weeks from now, its log is the only evidence of what it actually did.\n\n' +
          'Fail safely. An automated action taken on bad input can do damage faster than a person - a cleanup script that deletes based on a pattern that matched nothing should stop, not proceed with an empty list.',
      },
      {
        lessonId: 'yoddha-m04-l08',
        title: '4.8 Secure Scripting Practices',
        duration: '24 mins',
        subject: 'COMPUTER',
        summary: 'Writing scripts that do not become the vulnerability.',
        content:
          'A script written to improve security can introduce a worse problem than the one it solves.\n\n' +
          'Never embed credentials. A password in a script is in version control, in backups, and readable by anyone who can read the file - and scripts are routinely more readable than the systems they administer. Read secrets from a protected store or the environment at runtime.\n\n' +
          'Do not build commands by joining strings with input you did not generate. A filename containing a shell metacharacter becomes part of the command, which is command injection - the same flaw as SQL injection and the same fix: pass arguments structurally rather than assembling text.\n\n' +
          'Validate input at the boundary against what is allowed, not against what is forbidden.\n\n' +
          'Run with the least privilege that works. A script needing to read logs should not run as an administrator because that was easier to set up.\n\n' +
          'Mind the file permissions of the script itself. A script executed by a privileged scheduled task, writable by any user, is a complete privilege escalation - and it is one of the most common real findings in this area.',
      },
    ],
    quizzes: [
      {
        quizId: 'yoddha-m04-q01',
        title: 'Scripting and Secure Automation',
        subject: 'COMPUTER',
        timeLimitMins: 18,
        pointsReward: 70,
        questions: [
          {
            questionId: 'q1',
            question: 'A script reads a 4 GB log file entirely into memory before processing. What is the problem?',
            options: [
              'It will produce incorrect results',
              'It fails on large inputs; streaming line by line uses constant memory regardless of file size',
              'Memory is always faster, so this is correct',
              'It will corrupt the input file',
            ],
            correctIndex: 1,
            explanation:
              'It works in testing and fails on the day it matters. Streaming is the difference between a script that scales and one that does not.',
          },
          {
            questionId: 'q2',
            question: 'A parser silently skips log lines it cannot understand. Why is this dangerous?',
            options: [
              'It makes the script slower',
              'Unusual entries are the most likely to be malformed, so the analysis quietly excludes what you were looking for',
              'It prevents the script from being scheduled',
              'It is not dangerous if the file is large',
            ],
            correctIndex: 1,
            explanation:
              'Counting and reporting skipped lines is what makes the result honest. "Processed 482,113, skipped 27 as unparseable" is a result; silence is not.',
          },
          {
            questionId: 'q3',
            question: 'A script builds a shell command by joining text with a filename it did not generate. What is the risk?',
            options: [
              'The filename may be too long',
              'Command injection - a metacharacter in the filename becomes part of the command',
              'The script will run more slowly',
              'File permissions will be reset',
            ],
            correctIndex: 1,
            explanation:
              'Same flaw as SQL injection and the same fix: pass arguments structurally rather than assembling a command as text.',
          },
          {
            questionId: 'q4',
            question: 'A scheduled script is executed by a privileged task but the script file is writable by any user. What is this?',
            options: [
              'Good practice, since it allows easy updates',
              'A complete privilege escalation - any user can change what the privileged task runs',
              'Only a problem if the script contains credentials',
              'Acceptable if the directory is hidden',
            ],
            correctIndex: 1,
            explanation:
              'It is one of the most common real findings in this area, and it requires no exploitation at all - just editing a file.',
          },
          {
            questionId: 'q5',
            question: 'A nightly automated job stops working. Why is this the characteristic risk of unattended automation?',
            options: [
              'Automation always degrades over time',
              'No output looks exactly like everything being fine, so the failure is invisible unless success is also reported',
              'Scheduled jobs cannot be logged',
              'It will consume all available memory',
            ],
            correctIndex: 1,
            explanation:
              'Design for it: report success as well as failure, or alert on the absence of an expected success.',
          },
          {
            questionId: 'q6',
            question: 'Why should a script that appends results be idempotent?',
            options: [
              'To make it run faster',
              'Because scheduled jobs overlap, get triggered manually and are re-run after failures - a non-idempotent script corrupts its own output',
              'Because idempotent scripts use less memory',
              'It is only necessary for scripts that delete data',
            ],
            correctIndex: 1,
            explanation:
              'Running twice must not do the work twice. In practice, scripts are re-run far more often than their authors expect.',
          },
          {
            questionId: 'q7',
            question: 'Where should a script obtain a password it needs?',
            options: [
              'Embedded in the script, which is simplest',
              'From a protected secret store or the environment at runtime',
              'From a plain-text file beside the script',
              'Hard-coded but base64 encoded',
            ],
            correctIndex: 1,
            explanation:
              'A credential in a script is in version control, in backups, and readable by anyone who can read the file - and scripts are routinely more readable than the systems they administer. Encoding is not protection.',
          },
        ],
      },
    ],
    tasks: [
      {
        taskId: 'yoddha-m04-a01',
        title: 'Build a Defensive Automation Script',
        type: 'Activity',
        subject: 'COMPUTER',
        urgency: 'high',
        pointsReward: 90,
        dueOffsetDays: 21,
        iconName: 'Code',
        description:
          'Write a working script that analyses an authentication log and reports findings. Use any language you can run. It must operate only on files you supply it - it must not connect to anything.\n\n' +
          'INPUT. Create a sample log of at least 200 lines in this format, including at least 15 malformed or truncated lines deliberately:\n' +
          '  2026-03-14T02:41:07Z FAIL user=r.mehta src=203.0.113.44\n\n' +
          'THE SCRIPT MUST:\n' +
          '1. Stream the file rather than loading it entirely.\n' +
          '2. Parse defensively, counting and reporting how many lines it could not parse rather than skipping them silently.\n' +
          '3. Report: total events; failures per user; source addresses with more than three failures; and any user with three or more failures followed by a success within five minutes.\n' +
          '4. Detect password spraying - one source address failing against many distinct users - and explain in a comment why per-account thresholds miss this.\n' +
          '5. Write results to a new file, never over the input.\n' +
          '6. Exit with a clear message if the input file is missing or empty.\n\n' +
          'ALSO SUBMIT: a short note identifying which secure-scripting rules from lesson 4.8 apply to your script and how you satisfied each; and a description of one thing your script would get wrong, and what input would cause it.\n\n' +
          'Assessed on: whether it runs, whether the malformed lines are reported rather than hidden, whether the spraying detection is correct, and whether your stated weakness is a real one you found rather than a token admission.',
      },
    ],
  },

  {
    moduleId: 'yoddha-m05',
    title: 'Month 3 · Advanced Networking',
    order: 5,
    subject: 'CYBERSECURITY',
    lessons: [
      {
        lessonId: 'yoddha-m05-l01',
        title: '5.1 Routing',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'How packets find their way, and what routing reveals to an investigator.',
        content:
          'Routing is the decision, made at every hop, about where to send a packet next. Each router consults a table of destinations and chooses the most specific match.\n\n' +
          'Most specific wins. A route for a precise network beats a broader one covering it, and the default route - matching everything - is used only when nothing more specific applies. This single rule explains most routing behaviour and most routing mistakes.\n\n' +
          'Routes are learned statically, by configuration, or dynamically through protocols in which routers advertise what they can reach.\n\n' +
          'The security relevance is that routing is largely built on trust. A device advertising a route others accept can draw traffic towards itself - which is the shape of both accidental large-scale outages and deliberate interception.\n\n' +
          'For an investigator, the path traffic took is evidence. Traffic leaving through an unexpected gateway, or reaching a destination it should have no route to, indicates either a misconfiguration or a deliberate change - and both are worth explaining.',
      },
      {
        lessonId: 'yoddha-m05-l02',
        title: '5.2 Switching',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Local delivery, MAC tables, and the attacks specific to the switched layer.',
        content:
          'A switch delivers frames within a network segment. It learns which MAC address is on which port by watching traffic, and builds a table so it can deliver directly rather than flooding.\n\n' +
          'That learning is the weakness. The table is built by observation and has finite capacity, so an attacker who floods it with fabricated addresses can exhaust it and force the switch to flood all traffic to every port - which turns a switched network back into one where everyone sees everything.\n\n' +
          'A related attack forges responses in the address-resolution process, so a victim sends traffic intended for the gateway to an attacker instead. This is the classic local interception technique, and it works because the protocol has no authentication at all.\n\n' +
          'Defences exist at the switch: limiting how many addresses a port may learn, and inspecting address-resolution traffic for inconsistency.\n\n' +
          'The wider lesson is that being on the same local network as a target is a significant advantage, which is exactly why segmentation limits blast radius.',
      },
      {
        lessonId: 'yoddha-m05-l03',
        title: '5.3 Subnetting',
        duration: '26 mins',
        subject: 'CYBERSECURITY',
        summary: 'Dividing address space deliberately, and reading a network from its mask.',
        content:
          'Subnetting splits address space into smaller networks. The mask decides where the network part ends and the host part begins.\n\n' +
          'Written as a prefix length, /24 means the first 24 bits identify the network, leaving 8 bits for hosts - 256 addresses, of which 254 are usable once the network and broadcast addresses are excluded. A /25 halves that; a /23 doubles it.\n\n' +
          'Two addresses in the same subnet communicate directly; different subnets require a router. Being able to determine that from an address and a mask is the practical skill, because it tells you whether traffic between two hosts should have crossed a control point at all.\n\n' +
          'Subnetting is a security tool as much as an addressing one. Segmentation is implemented through it, and a well-designed scheme makes rules simple: if servers are all within one range, a rule about that range covers all of them and continues to cover new ones.\n\n' +
          'Sizing matters. Too small and you renumber later, which is painful; too large and one flat subnet holds hundreds of hosts that can all reach each other.',
      },
      {
        lessonId: 'yoddha-m05-l04',
        title: '5.4 DNS at Depth',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'Record types, delegation, and DNS as both attack surface and evidence.',
        content:
          'Beyond name-to-address lookup, DNS carries several record types that each tell you something: address records, mail routing, name aliases, name servers, and text records used for verification and policy.\n\n' +
          'Delegation is the structure. Each level of the hierarchy delegates authority for what is below it, which is why control of a domain\'s name servers is effectively control of the domain - and why compromise at the registrar is so serious.\n\n' +
          'As attack surface: cache poisoning misdirects users; a lookalike domain supports phishing, exactly as in the GARUD capstone; and because DNS is almost universally permitted outbound, it is used as a covert channel to carry data out in query names when everything else is blocked.\n\n' +
          'As evidence it is unusually valuable. Lookups reveal intent before any connection, they are recorded even when traffic is encrypted, and the pattern is informative - a host resolving hundreds of algorithmically generated names is exhibiting a well-known malware behaviour.\n\n' +
          'DNS logging is therefore among the highest-value monitoring an organisation can implement per unit of effort.',
      },
      {
        lessonId: 'yoddha-m05-l05',
        title: '5.5 DHCP',
        duration: '20 mins',
        subject: 'CYBERSECURITY',
        summary: 'Automatic addressing, its trust assumptions, and the logs it produces.',
        content:
          'DHCP assigns addresses automatically. A device broadcasts a request; a server offers an address along with the gateway and DNS servers to use; the device accepts.\n\n' +
          'The trust assumption is the problem: the client accepts the first plausible answer. An unauthorised server on the network can therefore supply its own address as the gateway and DNS server, placing itself in the path of all traffic - a complete interception achieved without exploiting any software flaw.\n\n' +
          'Defences are at the switch, which can be told which ports may legitimately answer.\n\n' +
          'For investigation, DHCP logs are essential and routinely forgotten. They map an address to a device and a time, which is what allows a log entry recording only an IP address to be connected to an actual machine. Without them, an address in a log from three weeks ago may be unattributable, because addresses are reassigned.\n\n' +
          'Lease duration therefore has investigative consequences, and DHCP log retention should match the retention of everything that records addresses.',
      },
      {
        lessonId: 'yoddha-m05-l06',
        title: '5.6 NAT',
        duration: '20 mins',
        subject: 'CYBERSECURITY',
        summary: 'Address translation, and the attribution problem it creates.',
        content:
          'Network address translation lets many devices with private addresses share one public address. The router rewrites the source address on the way out and reverses it on the way back, tracking connections so replies reach the right device.\n\n' +
          'It is often described as a security feature because inbound connections have no device to reach by default. That is a side effect rather than a design goal, and it should not be relied upon as a firewall.\n\n' +
          'The significant consequence is attribution. From outside, hundreds of devices appear as one address. A report that "this address attacked us" identifies an organisation, not a machine - and resolving it to a device requires the translation logs from the router, correlated by time and port.\n\n' +
          'Those logs are voluminous and frequently not kept, which is why external abuse reports so often cannot be traced internally.\n\n' +
          'The same problem runs in reverse: blocking an abusive external address may block an entire organisation behind it, most of whom did nothing.',
      },
      {
        lessonId: 'yoddha-m05-l07',
        title: '5.7 TCP and UDP in Practice',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Connection states, what scanning looks like, and reading flow records.',
        content:
          'A TCP connection moves through states, and the states are visible to anyone watching. That visibility is what makes scanning detectable.\n\n' +
          'A scan that completes handshakes appears as many short-lived connections to many ports. A scan that sends only the first packet and abandons the handshake leaves half-open connections - stealthier against simple logging, and very obvious to anything watching connection state.\n\n' +
          'Flow records summarise each conversation: source, destination, ports, protocol, duration, bytes each way. They are compact enough to keep for months, which frequently makes them the only evidence covering the start of a long intrusion.\n\n' +
          'Reading flows is a skill worth practising. A long-lived connection with small, regular outbound packets and little inbound is a control channel. A short connection with very large outbound volume is a transfer. Many short connections to sequential ports on one host is a scan. None of this requires seeing content.\n\n' +
          'With UDP there is no connection to observe, so flow records are inferred from timing - and a forged source address means the recorded source may be fiction.',
      },
      {
        lessonId: 'yoddha-m05-l08',
        title: '5.8 Network Traffic Analysis',
        duration: '26 mins',
        subject: 'CYBERSECURITY',
        summary: 'Finding the meaningful conversation among millions, using metadata.',
        content:
          'Traffic analysis on a real network means reducing an impossible volume to a reviewable set. The techniques are all forms of narrowing.\n\n' +
          'Narrow by time, using your timeline. Narrow by host, once you have a suspect. Narrow by direction and volume - large outbound transfers are rarer than large inbound and more often significant.\n\n' +
          'Then look for the shapes. Beaconing: connections at a strikingly regular interval, because software is regular and humans are not. Long duration with low volume: a channel held open. Connections to addresses with no corresponding DNS lookup, which suggests an address that was hard-coded rather than resolved. Traffic at hours when the host\'s user does not work.\n\n' +
          'Encryption does not defeat any of this, because all of it is metadata.\n\n' +
          'Everything depends on the baseline. Regular connections every five minutes are beaconing on a workstation and are entirely normal for a monitoring agent. The judgement is not in spotting the pattern but in knowing whether it belongs there, which requires knowing the environment.',
      },
    ],
    quizzes: [
      {
        quizId: 'yoddha-m05-q01',
        title: 'Advanced Networking',
        subject: 'CYBERSECURITY',
        timeLimitMins: 20,
        pointsReward: 80,
        questions: [
          {
            questionId: 'q1',
            question: 'A routing table has a default route and a specific route for 10.2.0.0/16. A packet is destined for 10.2.4.88. Which is used?',
            options: ['The default route', 'The specific /16 route, because most specific wins', 'Both, in sequence', 'Neither - the packet is dropped'],
            correctIndex: 1,
            explanation:
              'Most specific match wins, and the default route matches everything only when nothing more specific applies. This one rule explains most routing behaviour and most routing mistakes.',
          },
          {
            questionId: 'q2',
            question: 'An attacker floods a switch with fabricated MAC addresses. What is the effect?',
            options: [
              'The switch reboots',
              'The address table is exhausted and the switch floods traffic to all ports, exposing it',
              'All VLANs are merged permanently',
              'Routing tables are overwritten',
            ],
            correctIndex: 1,
            explanation:
              'The table is built by observation and has finite capacity. Exhausting it turns a switched network back into one where everyone can see everything.',
          },
          {
            questionId: 'q3',
            question: 'An external abuse report names your organisation\'s public IP address. Why can this rarely identify a device on its own?',
            options: [
              'Public addresses are randomly assigned',
              'NAT means hundreds of internal devices share that address; translation logs are needed to resolve it',
              'The report is probably fabricated',
              'IP addresses are not recorded by routers',
            ],
            correctIndex: 1,
            explanation:
              'From outside, NAT makes an organisation look like one machine. Resolving it needs translation logs correlated by time and port - and those are voluminous and frequently not kept.',
          },
          {
            questionId: 'q4',
            question: 'Why are DHCP logs essential to an investigation involving an IP address from three weeks ago?',
            options: [
              'They contain the contents of the traffic',
              'They map an address to a device at a time, and addresses are reassigned',
              'They record passwords used at login',
              'They are the only logs that cannot be altered',
            ],
            correctIndex: 1,
            explanation:
              'Without the lease record an address in an old log may be unattributable, because it has since been given to a different machine.',
          },
          {
            questionId: 'q5',
            question: 'A host makes a connection to the same external address every five minutes, transferring a few hundred bytes each time. What does this suggest, and what determines whether it is suspicious?',
            options: [
              'A large file transfer; nothing determines it',
              'Beaconing - but whether it is suspicious depends on whether that host normally does this',
              'A denial-of-service attack; always suspicious',
              'A DNS lookup loop; never suspicious',
            ],
            correctIndex: 1,
            explanation:
              'Regularity suggests software rather than a human. It is ordinary for a monitoring agent and alarming on a workstation - the baseline supplies the judgement.',
          },
          {
            questionId: 'q6',
            question: 'A connection is made to an external address with no preceding DNS lookup from that host. Why is that notable?',
            options: [
              'It proves the traffic is encrypted',
              'It suggests the address was hard-coded rather than resolved, which is unusual for legitimate software',
              'It means the connection failed',
              'It indicates the DNS server was offline',
            ],
            correctIndex: 1,
            explanation:
              'Most legitimate software resolves a name first. A hard-coded address avoids DNS-based blocking and leaves this specific gap in the record.',
          },
          {
            questionId: 'q7',
            question: 'A rogue DHCP server is placed on a network. What is the most serious consequence?',
            options: [
              'Devices receive duplicate addresses',
              'It can supply itself as gateway and DNS, intercepting all traffic without exploiting any software flaw',
              'The network slows down',
              'Switches stop learning MAC addresses',
            ],
            correctIndex: 1,
            explanation:
              'The client accepts the first plausible answer. That trust assumption allows complete interception through configuration alone.',
          },
          {
            questionId: 'q8',
            question: 'Two hosts are 10.4.2.10/24 and 10.4.3.10/24. What does this tell you?',
            options: [
              'They are on the same subnet and communicate directly',
              'They are on different subnets, so traffic between them must pass a router',
              'One of the addresses is invalid',
              'They cannot communicate at all',
            ],
            correctIndex: 1,
            explanation:
              'With a /24 mask the third octet is part of the network. Different subnets means a router is involved - which tells you whether the traffic should have crossed a control point.',
          },
        ],
      },
    ],
    tasks: [],
  },

  {
    moduleId: 'yoddha-m06',
    title: 'Month 3 · Network Defence',
    order: 6,
    subject: 'CYBERSECURITY',
    lessons: [
      {
        lessonId: 'yoddha-m06-l01',
        title: '6.1 Network Architecture',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'Designing a network so that security follows from its shape.',
        content:
          'A secure network is one whose structure makes insecure things difficult, rather than one with controls bolted onto an arbitrary shape.\n\n' +
          'The organising question is what must reach what. Most systems need to talk to very few others, and a design that starts from that produces natural chokepoints where traffic can be inspected.\n\n' +
          'Tiering is the classic expression: systems reachable from the internet are separated from application logic, which is separated from data. A compromise of the public tier then gains an attacker a position from which the interesting systems are still not directly reachable.\n\n' +
          'Management traffic deserves its own path. Administrative interfaces reachable from the general user network mean any compromised workstation is adjacent to the infrastructure.\n\n' +
          'Design for the compromise you expect rather than the one you hope to prevent. The useful question is not "can an attacker get in?" but "when they get a foothold here, what can they reach, and would we see them move?"',
      },
      {
        lessonId: 'yoddha-m06-l02',
        title: '6.2 Segmentation in Practice',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'Implementing segmentation without making the network unworkable.',
        content:
          'Segmentation is easy to describe and hard to implement, because real environments have undocumented dependencies.\n\n' +
          'The reliable sequence is to observe before enforcing. Put a control point in place that logs but permits, learn what actually talks to what, then write rules from the observed reality. Writing rules from the documented architecture blocks legitimate traffic nobody knew existed, and that failure is what causes segmentation projects to be abandoned.\n\n' +
          'Segment by function and sensitivity rather than by geography or department - those correlate poorly with what needs to talk to what.\n\n' +
          'Zones must be meaningful. Twenty zones nobody can reason about produce rules written by exception until the segmentation is nominal. A handful of well-chosen zones enforced strictly is worth far more.\n\n' +
          'And segmentation must be maintained. Every urgent exception granted during an incident and never reviewed erodes it, which is why exceptions need expiry dates rather than good intentions.',
      },
      {
        lessonId: 'yoddha-m06-l03',
        title: '6.3 Firewalls at Depth',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'Rule design, review, and the ways rulebases decay.',
        content:
          'A firewall is only as good as its rulebase, and rulebases decay predictably.\n\n' +
          'Order is evaluated top to bottom with first match winning, so a broad permit above a specific deny silently disables it. Rulebases accumulate over years, and a rule added in haste at the top can disable a hundred below it without any error.\n\n' +
          'Every rule should record why it exists, who requested it, and when it should be reviewed. A rulebase whose entries nobody can explain cannot be tightened, because nobody dares remove anything.\n\n' +
          'Watch for the characteristic decay patterns: any-to-any rules added "temporarily"; rules referencing decommissioned systems; duplicate rules doing the same thing differently; and shadowed rules that can never match because something above them always does.\n\n' +
          'Log denied traffic and review it - denials reveal both misconfiguration and reconnaissance. Logging permitted traffic is usually too voluminous for everything but valuable at boundaries between zones.\n\n' +
          'Deny by default remains the foundation. Everything else is exception management.',
      },
      {
        lessonId: 'yoddha-m06-l04',
        title: '6.4 IDS and IPS in Practice',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Placement, tuning and the operational reality of detection at scale.',
        content:
          'Placement determines what a sensor can see. At the internet boundary it sees traffic entering and leaving and nothing internal, which means lateral movement is invisible. Internal placement at zone boundaries sees movement between zones - frequently the more valuable view once an attacker is already inside.\n\n' +
          'Encrypted traffic is the practical limit. Inspecting it requires terminating and re-encrypting, which is intrusive, expensive and has its own privacy and stability implications. Many organisations therefore rely on metadata for encrypted flows and inspect only what is already plain.\n\n' +
          'Tuning is continuous, not a setup step. New systems generate new normal traffic; a sensor not tuned to match produces false positives that erode trust in every alert it raises.\n\n' +
          'Measure what matters. The useful metrics are how many alerts are investigated, how long that takes, and what proportion turn out to be real. Counting alerts generated measures nothing at all.\n\n' +
          'Detection without response capacity is theatre. An organisation with more alerts than it can investigate should improve tuning, not add sensors.',
      },
      {
        lessonId: 'yoddha-m06-l05',
        title: '6.5 Monitoring Coverage',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Knowing what you can and cannot see, and closing the gaps that matter.',
        content:
          'The most dangerous monitoring gap is the one nobody knows about, because absence of alerts is read as absence of problems.\n\n' +
          'Map coverage deliberately. For each zone and each significant system, ask what is logged, where those logs go, how long they are kept, and whether anything actually examines them. The last question eliminates a surprising amount of nominal coverage.\n\n' +
          'The recurring blind spots are consistent: traffic within a zone that never crosses a monitored boundary; encrypted traffic where only metadata is available; cloud services logging to their own console that nobody aggregates; personal devices; and anything added after the monitoring was designed.\n\n' +
          'Prioritise coverage by what an attacker must traverse. Full visibility of a low-value segment is worth less than partial visibility where an intruder must pass to reach anything important.\n\n' +
          'Test the coverage. A benign, authorised action that should generate an alert, performed deliberately, is the only way to confirm the chain works end to end - and it frequently reveals that logs are collected but no rule examines them.',
      },
      {
        lessonId: 'yoddha-m06-l06',
        title: '6.6 Secure Network Design',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'Putting it together, including the constraints that make designs real.',
        content:
          'A design is a set of trade-offs made deliberately. Presenting one means being explicit about what you chose and what you gave up.\n\n' +
          'Start from requirements: what the organisation does, what must reach what, what data exists and how sensitive it is, and what regulatory obligations apply. A design that does not reference these is a diagram, not a design.\n\n' +
          'Then the zones, the traffic permitted between them, where control points sit, what is logged at each, and how management access is separated.\n\n' +
          'Then state the constraints honestly. Budget, existing equipment, staff capacity to operate it, and the tolerance of the business for disruption during migration. A design requiring a team the organisation does not have is a design that will not be implemented, and proposing it wastes everyone\'s time.\n\n' +
          'Include the migration path. Organisations rarely build from nothing, and a design with no route from the current state is an aspiration. Staging it - one zone at a time, observing before enforcing - is what makes it achievable.',
      },
    ],
    quizzes: [],
    tasks: [
      {
        taskId: 'yoddha-m06-a01',
        title: 'Design a Secure Network Architecture',
        type: 'Activity',
        subject: 'CYBERSECURITY',
        urgency: 'high',
        pointsReward: 90,
        dueOffsetDays: 21,
        iconName: 'Waypoints',
        description:
          'Produce a segmentation design for a real set of constraints, including the migration path.\n\n' +
          'THE ORGANISATION. A 200-person tutoring company across three sites. It runs: a public website and student portal; an internal student-records system holding personal data of minors; a finance system; a shared file server; staff laptops; classroom desktops used by students; guest Wi-Fi; and IP cameras. Currently everything is on one flat network. There are two IT staff. There is no budget for new hardware this year, though existing switches support VLANs. Student records are subject to data-protection obligations.\n\n' +
          'PRODUCE:\n' +
          '1. A zone design with a stated rationale for each zone. Say explicitly why you did not simply create one zone per department.\n' +
          '2. A traffic matrix: for each pair of zones, what is permitted and why. Default must be deny.\n' +
          '3. Where control points sit, and what is logged at each.\n' +
          '4. How administrative access is separated, and what breaks if it is not.\n' +
          '5. Three monitoring blind spots your own design still leaves, and what you would do about each if you had budget.\n' +
          '6. A staged migration path that does not require an outage, using observe-before-enforce. State what you would do if enforcement broke something unexpected.\n' +
          '7. What you gave up. Every design trades something - name yours.\n\n' +
          'Assessed on: whether the design is achievable by two people with no new hardware, whether the traffic matrix is genuinely minimal rather than permissive, whether the blind spots are real ones in your design rather than generic, and whether item 7 shows honest engineering judgement.',
      },
    ],
  },
];

export default COMMAND;
