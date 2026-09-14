/**
 * GARUD, months 1-3: foundation and digital confidence.
 *
 * The arc moves from being able to speak clearly about your own work, to
 * handling a computer as a working instrument rather than an appliance, to
 * understanding the systems and networks that everything later in the stage
 * depends on.
 *
 * Every activity carries its own subject. The course pillar is only a fallback
 * for anything untagged, and nothing here is left untagged - a GARUD lesson on
 * subnetting must credit Cybersecurity, not the course's `communicate` pillar.
 */

export const FOUNDATION = [
  {
    moduleId: 'garud-m01',
    title: 'Month 1 · Personal Growth & Communication',
    order: 1,
    subject: 'ENGLISH',
    lessons: [
      {
        lessonId: 'garud-m01-l01',
        title: '1.1 From Beginner to Builder',
        duration: '20 mins',
        subject: 'ENGLISH',
        summary: 'What changes between finishing a foundation course and building things people rely on.',
        content:
          'PRARAMBH asked you to show up and learn. GARUD asks you to produce work that someone else depends on, which is a different discipline.\n\n' +
          'A beginner asks "did I understand this?". A builder asks "does this work, and can I explain why?". The second question is harder because it has an answer outside your own head - the code runs or it does not, the report is clear or the reader is confused.\n\n' +
          'Three habits separate the two. Builders finish things, because an unfinished piece teaches you nothing about whether your idea survives contact with reality. Builders show their work early, while it is still cheap to change. And builders separate the work from themselves - a criticism of your report is not a criticism of you, and treating it as one is the fastest way to stop improving.\n\n' +
          'Over this stage you will produce investigations, reports and presentations that are assessed on whether they hold up, not on whether you tried. That is the point.',
      },
      {
        lessonId: 'garud-m01-l02',
        title: '1.2 Confidence in Professional Communication',
        duration: '22 mins',
        subject: 'ENGLISH',
        summary: 'Confidence as preparation and clarity, not volume or performance.',
        content:
          'Professional confidence is not a personality trait you either have or lack. It is the visible result of three things you can practise.\n\n' +
          'The first is knowing your material well enough to say it in your own words. If you can only deliver a point by reciting a memorised sentence, any interruption derails you. If you understand it, you can approach it from whichever direction the conversation takes.\n\n' +
          'The second is having decided in advance what you want the listener to do or believe when you finish. Speakers who ramble usually have not decided this, so every sentence is a fresh attempt to find the point.\n\n' +
          'The third is being willing to say "I do not know, I will find out". People trust that far more than a confident guess, and a confident guess that turns out wrong costs you the credibility you were trying to protect.\n\n' +
          'Volume, pace and gesture matter, but they are downstream of these three. Nobody is persuaded by a forceful delivery of an unclear idea.',
      },
      {
        lessonId: 'garud-m01-l03',
        title: '1.3 Speaking Clearly and Structuring Ideas',
        duration: '24 mins',
        subject: 'ENGLISH',
        summary: 'Point, reason, example, restatement - a structure that survives being interrupted.',
        content:
          'Unstructured speech makes the listener do the work of organising it, and most listeners will not bother.\n\n' +
          'A reliable structure for any spoken point is: state the point, give the reason, give one concrete example, then restate the point in one sentence. It takes about ninety seconds and it survives interruption, because after any question you can return to the step you were on.\n\n' +
          'For anything longer, decide the order deliberately. Chronological order suits an incident or a process. Order of importance suits a recommendation, because the listener may stop after the first item. Problem-then-solution suits a proposal. Choosing none of these and simply saying things as they occur to you is the default, and it is the one that loses people.\n\n' +
          'A practical test: after you speak, can the listener repeat your main point in one sentence? If not, the structure failed, however well you delivered it.',
      },
      {
        lessonId: 'garud-m01-l04',
        title: '1.4 Active Listening',
        duration: '20 mins',
        subject: 'ENGLISH',
        summary: 'Listening to understand rather than listening for your turn to speak.',
        content:
          'Most people listen for the gap where they can start talking. Active listening is the deliberate alternative, and it is a skill you can see working.\n\n' +
          'The core move is to summarise before you respond: "So the problem is that the reports arrive after the deadline, and the cause is that the data is late - have I got that right?". This does three things at once. It proves you were listening, it gives the speaker a chance to correct you cheaply, and it forces you to actually process what they said rather than rehearsing.\n\n' +
          'The second move is to notice what was not said. If someone describes a failure and never mentions who was affected, that absence is information.\n\n' +
          'In investigation and incident work, which you will do later in this stage, careless listening produces wrong conclusions that are expensive to reverse. A witness account you half-heard becomes a fact in your report, and then a fact in someone else\'s decision.',
      },
      {
        lessonId: 'garud-m01-l05',
        title: '1.5 Asking Better Questions',
        duration: '20 mins',
        subject: 'ENGLISH',
        summary: 'Open, closed and leading questions, and what each one is good and bad for.',
        content:
          'The quality of what you learn is capped by the quality of what you ask.\n\n' +
          'Closed questions have a short fixed answer: "Did the system restart?". They are good for confirming specifics and bad for discovery, because they only test what you already suspected.\n\n' +
          'Open questions invite explanation: "What happened before the system restarted?". They are how you find the thing you did not know to ask about. Start with these.\n\n' +
          'Leading questions contain their own answer: "The update caused this, didn\'t it?". Avoid them. People, especially people who think you know more than they do, will agree with a leading question to be helpful, and you will have manufactured your own evidence.\n\n' +
          'A useful sequence is to open broad, let the person talk, then narrow to closed questions to pin down the specifics you now know matter. Reversing that order means you narrow onto the wrong thing.',
      },
      {
        lessonId: 'garud-m01-l06',
        title: '1.6 Giving and Receiving Feedback',
        duration: '22 mins',
        subject: 'ENGLISH',
        summary: 'Making feedback specific and actionable, and receiving it without defending.',
        content:
          'Feedback that cannot be acted on is not feedback, it is an opinion.\n\n' +
          'When giving it, name the specific thing, the effect it had, and what would change it. "Your report was confusing" is useless. "The findings section put the conclusion last, so I had read three pages before I knew what you were telling me - lead with it" can actually be used.\n\n' +
          'Separate the work from the person. "This section is unclear" and "you are unclear" are different statements, and only one of them is about something the person can fix.\n\n' +
          'When receiving it, the discipline is to ask a question before you explain. Explaining first - even when your explanation is correct - reads as defending, and people stop offering you anything useful. Ask what specifically was unclear, ask what they expected, and decide afterwards whether you agree. You are allowed to disagree; you are not allowed to disagree before you have understood.',
      },
    ],
    quizzes: [
      {
        quizId: 'garud-m01-q01',
        title: 'Communication Foundations',
        subject: 'ENGLISH',
        timeLimitMins: 12,
        pointsReward: 50,
        questions: [
          {
            questionId: 'q1',
            question: 'A colleague describes a problem and you reply by summarising what they said before giving your view. What is the main benefit?',
            options: [
              'It fills time while you think of a response',
              'It lets them correct a misunderstanding before you act on it',
              'It shows you are more senior than them',
              'It avoids having to answer the question',
            ],
            correctIndex: 1,
            explanation:
              'Summarising surfaces a misunderstanding while it is still cheap to fix. Acting on a half-heard account is how a wrong assumption becomes a fact in someone else\'s decision.',
          },
          {
            questionId: 'q2',
            question: 'Which question is most likely to contaminate the answer you get?',
            options: [
              'What happened just before the outage?',
              'Can you walk me through your morning?',
              'The new update caused this, didn\'t it?',
              'Who else was using the system at the time?',
            ],
            correctIndex: 2,
            explanation:
              'That is a leading question - it contains its own answer. People often agree with them to be helpful, especially when they think you know more than they do, and you end up having manufactured your own evidence.',
          },
          {
            questionId: 'q3',
            question: 'Which piece of feedback is actionable?',
            options: [
              'Your presentation was weak.',
              'You need to be more confident.',
              'You spoke for nine minutes before saying what you were recommending - put the recommendation first.',
              'I did not really follow it.',
            ],
            correctIndex: 2,
            explanation:
              'It names the specific thing, the effect, and what to change. The other three describe an impression without giving the person anything they can do differently.',
          },
          {
            questionId: 'q4',
            question: 'You are recommending one of three options to a busy manager who may stop reading early. Which order serves them best?',
            options: [
              'Chronological - how you investigated each option',
              'Your recommendation first, then the reasoning',
              'All three options described neutrally, conclusion at the end',
              'Alphabetical by option name',
            ],
            correctIndex: 1,
            explanation:
              'Order of importance suits a recommendation precisely because the reader may stop after the first item. Chronological order suits describing an incident or a process, not arguing for a decision.',
          },
          {
            questionId: 'q5',
            question: 'You are asked a question you cannot answer in a meeting. What is the professionally strongest response?',
            options: [
              'Give your best guess confidently',
              'Say you do not know and will find out by a stated time',
              'Redirect to a topic you do know',
              'Say the question is not relevant',
            ],
            correctIndex: 1,
            explanation:
              'A confident guess that turns out wrong costs exactly the credibility it was meant to protect. Committing to find out, with a time attached, is both honest and useful.',
          },
          {
            questionId: 'q6',
            question: 'What is the most reliable test of whether you structured a spoken point well?',
            options: [
              'You did not use notes',
              'You finished within the time limit',
              'The listener can repeat your main point in one sentence',
              'Nobody interrupted you',
            ],
            correctIndex: 2,
            explanation:
              'Structure exists to get the point into the listener\'s head. If they cannot restate it, the structure failed regardless of how fluent the delivery was.',
          },
        ],
      },
    ],
    tasks: [
      {
        taskId: 'garud-m01-a01',
        title: 'Introduce Yourself Professionally',
        type: 'Task',
        subject: 'ENGLISH',
        urgency: 'medium',
        pointsReward: 40,
        dueOffsetDays: 10,
        iconName: 'Mic',
        description:
          'Write and record a 90-second professional introduction of yourself, then submit the written version.\n\n' +
          'It must contain, in this order: who you are and what you are currently working on; one thing you have actually built, studied or fixed, described concretely enough that a listener could picture it; and what you are trying to get better at in GARUD.\n\n' +
          'Constraints that make this harder than it sounds: no more than 200 words, no adjectives about yourself that you do not immediately back with evidence ("hardworking" on its own does not survive), and it must make sense to someone who has never heard of Nalanda Nexus.\n\n' +
          'Assessed on: structure (is there a clear order?), concreteness (is the example real and specific?), and economy (is every sentence earning its place?).',
      },
    ],
  },

  {
    moduleId: 'garud-m02',
    title: 'Month 1 · Digital Fluency',
    order: 2,
    subject: 'COMPUTER',
    lessons: [
      {
        lessonId: 'garud-m02-l01',
        title: '2.1 Understanding Modern Digital Work',
        duration: '20 mins',
        subject: 'COMPUTER',
        summary: 'How digital work is actually organised, and why that shape matters to you.',
        content:
          'Most professional work now happens across several systems at once: something where files live, something where conversation happens, something that tracks the work itself, and something that holds the official record.\n\n' +
          'The common failure is treating these as interchangeable. A decision made in a chat message is invisible to anyone who joins next month. A file that only exists on your laptop does not exist as far as the organisation is concerned. A task nobody wrote down is a task that will be forgotten and then blamed on someone.\n\n' +
          'The skill is knowing which system a given piece of information belongs in, and putting it there at the time rather than later. This sounds administrative. It is actually what makes the difference between someone whose work can be picked up by others and someone whose work stops when they are away.\n\n' +
          'The rest of this month is about the mechanics: where files go, how they are named, and how to work with other people inside them.',
      },
      {
        lessonId: 'garud-m02-l02',
        title: '2.2 Files, Folders and File Organization',
        duration: '22 mins',
        subject: 'COMPUTER',
        summary: 'Naming and structure that still make sense to someone else in six months.',
        content:
          'A file system is a tool for finding things later, usually by someone who is not you.\n\n' +
          'Names should sort usefully and read unambiguously. Dates go in ISO form - 2026-03-14, not 14-3-26 - because that is the only format that sorts chronologically when sorted alphabetically. Versions go as numbers with leading zeros (v02, not v2) for the same reason. Avoid spaces where the file may be handled by scripts or command lines later, and never rely on "final", "final2", "final-real" to encode version order.\n\n' +
          'Folder depth is a trade-off. Too flat and you scan hundreds of items; too deep and nobody can remember where anything lives. Three or four levels is usually right, organised by the thing a person would search for first - project, then type, then date, rather than the reverse.\n\n' +
          'The test of a structure is whether a colleague can find a file you made without asking you. If the answer is no, the structure is for you alone, which means it is not a structure.',
      },
      {
        lessonId: 'garud-m02-l03',
        title: '2.3 Cloud Storage Fundamentals',
        duration: '20 mins',
        subject: 'COMPUTER',
        summary: 'Sync is not backup, sharing is not copying, and who can actually see your files.',
        content:
          'Cloud storage introduces three distinctions people routinely get wrong, and each one causes a specific kind of loss.\n\n' +
          'Sync is not backup. If you delete a file on your laptop, sync obediently deletes it everywhere. Backup means a copy that is not affected by what you do to the original. Most people discover this distinction on the day they need it.\n\n' +
          'Sharing is not copying. When you share a link, you are giving access to the living file - if you then edit it, the other person sees the edit. If you wanted them to have the version as it stood, you needed to send a copy.\n\n' +
          'Link permissions are a genuine security boundary. "Anyone with the link" means anyone, including anyone the link is forwarded to, indexed by, or pasted into. Later in this stage you will study access control formally; this is the everyday instance of it.\n\n' +
          'Before sharing anything, ask: who can see it, what can they do, and does it expire?',
      },
      {
        lessonId: 'garud-m02-l04',
        title: '2.4 Productivity Tools',
        duration: '22 mins',
        subject: 'COMPUTER',
        summary: 'Getting a computer to do repetitive work so that your attention goes to the parts that need it.',
        content:
          'A productivity tool earns its place by removing a repeated decision, not by having more features.\n\n' +
          'Keyboard shortcuts are the clearest example. Reaching for the mouse to copy, paste, switch window or search costs a second or two each time and, more importantly, breaks concentration. Learning ten shortcuts you use constantly is worth more than knowing a hundred you use never.\n\n' +
          'Templates remove the blank page. If you write the same kind of document repeatedly - a status update, a report, a meeting note - the structure should be a template, so your effort goes into the content rather than re-deciding the shape each time.\n\n' +
          'Search beats filing. Modern systems index content, so a good name plus search usually finds a file faster than navigating to it. This does not make organisation pointless; it makes naming more important than nesting.\n\n' +
          'The underlying principle carries into automation and scripting, which you will meet properly in YODDHA: notice what you do repeatedly, then make the machine do it.',
      },
      {
        lessonId: 'garud-m02-l05',
        title: '2.5 Professional Email Practices',
        duration: '20 mins',
        subject: 'COMPUTER',
        summary: 'Subject lines, recipients, and writing something that gets a useful reply.',
        content:
          'Email is the system of record in most organisations, which means it is read later, by people who were not part of the conversation.\n\n' +
          'The subject line should let someone decide whether to open it and find it again a year later. "Question" fails both tests; "Access request for the reporting dashboard - needed by Friday" passes both.\n\n' +
          'Recipients carry meaning. To is for people who must act. Cc is for people who need to know but need do nothing. Putting everyone in To is how a request ends up owned by nobody, because each recipient assumes another will handle it. Reply-all is appropriate only when every recipient needs the reply.\n\n' +
          'Structure the body so the ask is visible without reading to the end: what you need, why, and by when, in the first three lines. Detail goes below for whoever wants it.\n\n' +
          'Finally: email is neither private nor deletable in practice. Write on the assumption it will be forwarded, because eventually one will be.',
      },
      {
        lessonId: 'garud-m02-l06',
        title: '2.6 Digital Collaboration',
        duration: '22 mins',
        subject: 'COMPUTER',
        summary: 'Working in shared documents without overwriting each other or losing the decision trail.',
        content:
          'Collaboration tools change the failure mode from "I do not have the latest version" to "we have all edited at once and nobody knows what was decided".\n\n' +
          'Comments and suggestions exist to separate proposing a change from making one. On someone else\'s draft, suggest; on a shared working document, edit but say what you changed. Silently rewriting a colleague\'s paragraph is technically possible and socially expensive.\n\n' +
          'Version history is your undo for other people\'s mistakes as well as your own. Knowing how to open it, compare versions and restore one is a basic competence, not an advanced feature.\n\n' +
          'The decision trail matters more than the document. When a discussion in comments produces a decision, write the decision into the document itself and resolve the thread. Otherwise the reasoning lives in a comment nobody reads, and in six months the document says what was decided but not why - which is how decisions get quietly reversed by someone who did not know the reason.',
      },
    ],
    quizzes: [
      {
        quizId: 'garud-m02-q01',
        title: 'Digital Fluency Assessment',
        subject: 'COMPUTER',
        timeLimitMins: 12,
        pointsReward: 50,
        questions: [
          {
            questionId: 'q1',
            question: 'You delete an important file from your synced cloud folder by mistake. Why is "it was in the cloud" not automatically reassuring?',
            options: [
              'Cloud storage is less reliable than a hard drive',
              'Sync propagates the deletion to every copy - sync is not backup',
              'Cloud files cannot be recovered under any circumstances',
              'The file was never actually uploaded',
            ],
            correctIndex: 1,
            explanation:
              'Sync keeps copies identical, which includes making them identically deleted. Backup means a copy that is not affected by what you do to the original.',
          },
          {
            questionId: 'q2',
            question: 'Which filename will sort correctly and still be unambiguous in a year?',
            options: [
              'report final REAL v2.docx',
              '14-3-26 report.docx',
              '2026-03-14_incident-report_v02.docx',
              'Report (latest).docx',
            ],
            correctIndex: 2,
            explanation:
              'ISO dates sort chronologically when sorted alphabetically, and a zero-padded version number keeps v02 before v10. "final", "REAL" and "latest" encode no reliable order.',
          },
          {
            questionId: 'q3',
            question: 'You need three people to act on a request and two others to be aware of it. How should the recipients be set?',
            options: [
              'All five in To',
              'All five in Cc',
              'The three actors in To, the two others in Cc',
              'One person in To and forward it to the rest later',
            ],
            correctIndex: 2,
            explanation:
              'To means "you must act", Cc means "for your awareness". Putting everyone in To is how a request ends up owned by nobody, since each person assumes another will handle it.',
          },
          {
            questionId: 'q4',
            question: 'A shared link set to "anyone with the link" is best understood as what?',
            options: [
              'Private, because the link is hard to guess',
              'Visible to anyone the link reaches, including onward forwards',
              'Only visible to people inside your organisation',
              'Automatically expiring after 24 hours',
            ],
            correctIndex: 1,
            explanation:
              'Link-based access travels with the link. It is the everyday instance of the access-control principles covered formally later in this stage.',
          },
          {
            questionId: 'q5',
            question: 'A comment thread on a shared document ends in a decision. What should happen next?',
            options: [
              'Leave the thread open so the reasoning is preserved',
              'Delete the thread to keep the document clean',
              'Write the decision into the document, then resolve the thread',
              'Email the decision to everyone and leave the document unchanged',
            ],
            correctIndex: 2,
            explanation:
              'A decision that lives only in a comment is a decision nobody will find. Writing it into the document keeps the what and the why together, which is what stops it being quietly reversed later.',
          },
        ],
      },
    ],
    tasks: [
      {
        taskId: 'garud-m02-a01',
        title: 'Build a Professional Digital Workspace',
        type: 'Task',
        subject: 'COMPUTER',
        urgency: 'medium',
        pointsReward: 40,
        dueOffsetDays: 14,
        iconName: 'FolderTree',
        description:
          'Design and build a working folder structure for your GARUD studies, then document it.\n\n' +
          'Build: a folder tree no more than four levels deep covering your notes, assignments, evidence files and finished reports, using a naming convention that sorts correctly by date and version.\n\n' +
          'Submit: a short document containing the folder tree as text, your naming rule stated in one or two sentences, three example filenames that follow it, and one paragraph explaining where you would put a file that could plausibly belong in two places - and why.\n\n' +
          'Assessed on: whether someone else could find a file in your structure without asking you, whether the naming rule is actually a rule rather than a description of what you happened to do, and whether the ambiguous-file answer shows you thought about it rather than avoided it.',
      },
    ],
  },

  {
    moduleId: 'garud-m03',
    title: 'Month 2 · Professional English',
    order: 3,
    subject: 'ENGLISH',
    lessons: [
      {
        lessonId: 'garud-m03-l01',
        title: '3.1 Professional Vocabulary',
        duration: '20 mins',
        subject: 'ENGLISH',
        summary: 'Precision over formality - and why long words usually signal the opposite of expertise.',
        content:
          'Professional vocabulary is often mistaken for formal vocabulary. They are not the same, and confusing them makes writing worse.\n\n' +
          'Precision is the actual goal. "The service was slow" and "the service responded in about four seconds, against a normal of 200 milliseconds" both describe the same event, but only one can be acted on. Precise words are frequently short: failed, delayed, missing, unclear.\n\n' +
          'Inflated vocabulary - utilise for use, commence for start, in order to for to - adds length without adding meaning, and readers notice. The pattern is strongest in people who are least sure of their material, which is exactly the impression it creates.\n\n' +
          'Technical terms are worth using when they are precise and your reader knows them. "Phishing" is better than "a fake email designed to trick someone" when writing for colleagues, and worse when writing for a parent. Knowing which is which is the skill; assuming your reader shares your vocabulary is the common failure.',
      },
      {
        lessonId: 'garud-m03-l02',
        title: '3.2 Formal vs Informal Communication',
        duration: '20 mins',
        subject: 'ENGLISH',
        summary: 'Reading the register a situation calls for, and what happens when you misjudge it.',
        content:
          'Register is the level of formality a situation expects. Getting it wrong is not a grammar error - it is a social signal, and it is read as one.\n\n' +
          'Too informal in a formal setting reads as not taking the matter seriously: a one-line "sorted" in reply to a customer complaint, an emoji in a security incident report. Too formal in an informal setting reads as distant or sarcastic, and makes people reluctant to bring you things.\n\n' +
          'The variables are the audience, the permanence of the medium, and the stakes. A message to your team in chat about lunch is at one extreme; a written finding that may be read by someone senior a year from now is at the other. Most work sits between, and the reliable default is plain, direct and courteous - which works almost everywhere.\n\n' +
          'One rule that holds regardless: never let informality reach the record. The chat message becomes a screenshot, and the screenshot reaches an audience you did not write for.',
      },
      {
        lessonId: 'garud-m03-l03',
        title: '3.3 Writing Professional Emails',
        duration: '24 mins',
        subject: 'ENGLISH',
        summary: 'A structure for emails that get read and answered.',
        content:
          'A professional email has a job: to get a specific outcome from a specific person. Structure it so that job is visible immediately.\n\n' +
          'Line one states the ask or the news. Not background, not pleasantries - the thing. "I need approval to extend the reporting deadline to Friday 20th." A reader who stops there still knows what you want.\n\n' +
          'The next short paragraph gives the reason, in enough detail to justify the ask and no more. Then, if needed, the detail or options below, clearly separated so it can be skipped.\n\n' +
          'Close with what happens next and by when: "If I do not hear back by Wednesday I will assume the original date stands." An email with no next step tends to receive no reply, because no reply has no consequence.\n\n' +
          'Before sending, reread as the recipient. Is the ask obvious? Is the deadline explicit? Would this make sense to someone forwarded into it halfway? If any answer is no, it is not finished.',
      },
      {
        lessonId: 'garud-m03-l04',
        title: '3.4 Technical Explanation Skills',
        duration: '24 mins',
        subject: 'ENGLISH',
        summary: 'Explaining something technical to someone who is not technical, without patronising them.',
        content:
          'The hardest audience is an intelligent person who does not share your background. They will notice both oversimplification and jargon, and resent either.\n\n' +
          'Start with what it does and why it matters, not how it works. "This stops someone using a stolen password on its own" is a better opening than "this implements time-based one-time passwords".\n\n' +
          'Use an analogy, then immediately state where it breaks. Analogies are powerful because they import an existing mental model, and dangerous for exactly the same reason - the listener will also import the parts that do not apply. Saying "it is like a key, except the key changes every thirty seconds and the lock knows" does the work and closes the gap.\n\n' +
          'Introduce a technical term only after the idea is understood, and only if the person will encounter it again. A term with no future use is a burden, not an education.\n\n' +
          'Check understanding by asking them to explain it back, not by asking "does that make sense?" - to which almost everyone says yes.',
      },
      {
        lessonId: 'garud-m03-l05',
        title: '3.5 Presentation Structure',
        duration: '22 mins',
        subject: 'ENGLISH',
        summary: 'Designing a presentation around one message the audience can carry away.',
        content:
          'A presentation is not a document read aloud. It has one advantage over a document - you are present - and one disadvantage: the audience cannot re-read.\n\n' +
          'That single constraint drives the structure. Decide the one sentence you want the audience to be able to repeat afterwards. Everything in the presentation either supports that sentence or is cut.\n\n' +
          'A structure that works for almost any technical presentation: the situation (what the audience already knows), the complication (what changed or what is wrong), the question that raises, your answer, then the evidence for it. Ending on evidence rather than opening with it is deliberate - people accept evidence more readily once they know what it is evidence for.\n\n' +
          'Slides carry the skeleton, not the script. If a slide is readable as a document, the audience will read it instead of listening to you, and you will be competing with yourself.\n\n' +
          'Rehearse the opening and closing sentences until they are exact. Those are the two moments people remember.',
      },
      {
        lessonId: 'garud-m03-l06',
        title: '3.6 Speaking Under Pressure',
        duration: '22 mins',
        subject: 'ENGLISH',
        summary: 'Staying clear when the question is hostile, the answer is bad, or you have been interrupted.',
        content:
          'Pressure does not change what good communication is; it removes your capacity to improvise it. So the preparation has to happen beforehand.\n\n' +
          'Prepare the three questions you least want to be asked, and prepare an honest answer to each. In practice the feared question is usually "why did this go wrong?" or "why did you not catch it sooner?" - both of which have honest answers that are better received than evasion.\n\n' +
          'When interrupted, finish the sentence you are on, then take the question. Abandoning mid-sentence makes you look rattled and loses the point you were making.\n\n' +
          'When you do not know, say so, then say what you will do: "I do not have that figure. I will have it by end of day." Notice this is the same move as in lesson 1.2 - under pressure it is harder and matters more.\n\n' +
          'When the news is bad, lead with it. Delivering bad news slowly does not soften it; it makes the audience suspect you were trying to hide it, and now they are evaluating your honesty as well as the news.',
      },
    ],
    quizzes: [],
    tasks: [
      {
        taskId: 'garud-m03-a01',
        title: 'Professional Email and Three-Minute Presentation',
        type: 'Task',
        subject: 'ENGLISH',
        urgency: 'high',
        pointsReward: 60,
        dueOffsetDays: 14,
        iconName: 'Presentation',
        description:
          'Two connected deliverables built on one scenario.\n\n' +
          'Scenario: your team\'s weekly report has been arriving late for a month. You have found the cause - the data it depends on is published a day later than it used to be. You need the reporting deadline moved by one day.\n\n' +
          'Part 1 - the email. Write the email requesting the change. Maximum 150 words. The ask must be in the first line, the reason must be in the second paragraph, and it must contain an explicit next step with a date.\n\n' +
          'Part 2 - the presentation. Prepare a three-minute spoken version for a manager who has not read the email, structured as situation, complication, question, answer, evidence. Submit your slides or speaking notes, plus the single sentence you want them to be able to repeat afterwards.\n\n' +
          'Assessed on: whether the ask survives a reader who stops after one line, whether the presentation has one message rather than several, and whether the email and presentation agree with each other.',
      },
    ],
  },

  {
    moduleId: 'garud-m04',
    title: 'Month 2 · Productivity & Computer Skills',
    order: 4,
    subject: 'COMPUTER',
    lessons: [
      {
        lessonId: 'garud-m04-l01',
        title: '4.1 Advanced Word Processing',
        duration: '22 mins',
        subject: 'COMPUTER',
        summary: 'Styles, structure and automatic references - making long documents maintainable.',
        content:
          'The difference between a document that survives editing and one that falls apart is whether its structure is real or visual.\n\n' +
          'Styles are the mechanism. Marking a line as Heading 2 tells the document what it is; making it bold and large only tells it how to look. Real structure means the table of contents can generate itself, the navigation pane works, the whole document can be restyled in one action, and screen readers can announce the hierarchy.\n\n' +
          'The same logic applies to numbering, captions and cross-references. A manually typed "see section 3.2" becomes wrong the moment a section is inserted above it; an automatic cross-reference updates. In a long report that will be revised several times, this is the difference between a document you can edit and one you must proofread from the start every time.\n\n' +
          'Track changes and comments are for collaboration, not for storing your own history - use versions for that.',
      },
      {
        lessonId: 'garud-m04-l02',
        title: '4.2 Spreadsheets Fundamentals',
        duration: '24 mins',
        subject: 'COMPUTER',
        summary: 'What a spreadsheet is actually good at, and the layout that makes it work.',
        content:
          'A spreadsheet is a grid of values where some cells are computed from others. Almost every spreadsheet problem comes from ignoring the second half of that sentence.\n\n' +
          'Keep raw data, calculations and presentation separate. Raw data goes in one sheet, untouched, one row per record and one column per field, with a single header row and no blank rows or merged cells inside it. Calculations reference that sheet. Presentation - charts, formatted summaries - references the calculations.\n\n' +
          'Typing a number into a cell that should be computed is the single most common source of silent error, because it looks identical to a computed cell and stops updating when the inputs change.\n\n' +
          'Merged cells, values stored as text, and dates entered in inconsistent formats are the three things that will break every later analysis. Fix them at entry, not at analysis.\n\n' +
          'A spreadsheet laid out this way can be checked by someone else. One where formatting, data and formulas are interleaved cannot.',
      },
      {
        lessonId: 'garud-m04-l03',
        title: '4.3 Formulas and Functions',
        duration: '26 mins',
        subject: 'COMPUTER',
        summary: 'References, conditionals and lookups - the small set that covers most real work.',
        content:
          'A handful of functions covers the large majority of practical spreadsheet work.\n\n' +
          'Aggregation: SUM, AVERAGE, COUNT, and their conditional forms SUMIF and COUNTIF. Conditional logic: IF, and the AND/OR combinations that let one formula express a real rule.\n\n' +
          'Lookup is where most people get stuck. A lookup answers "given this key, what is the matching value in that table?". Understanding that it needs a key that is genuinely unique is more important than memorising the function\'s arguments - most lookup bugs are duplicate or mistyped keys, not syntax.\n\n' +
          'Relative and absolute references decide what happens when you copy a formula. A relative reference shifts with the copy; an absolute one, written with a dollar sign, stays put. Copying a formula down a column and finding the results nonsense is almost always a reference that should have been absolute.\n\n' +
          'Finally, build formulas in steps and check intermediate values. A single long nested formula that returns the wrong answer gives you nothing to debug.',
      },
      {
        lessonId: 'garud-m04-l04',
        title: '4.4 Data Organisation',
        duration: '22 mins',
        subject: 'COMPUTER',
        summary: 'Structuring data so it can be sorted, filtered and trusted.',
        content:
          'Organised data is data where every row means the same kind of thing and every column means the same kind of fact.\n\n' +
          'That sounds obvious and is violated constantly: a column holding "12", "twelve" and "about 12"; a date column with three formats; a name column that sometimes holds two people. Each of these silently breaks sorting, filtering and any calculation downstream.\n\n' +
          'One fact per cell is the rule that prevents most of it. A full address in one cell cannot be sorted by city. A "name" column cannot be sorted by surname. Splitting at entry costs seconds; splitting afterwards costs hours and introduces errors.\n\n' +
          'Validation at entry - restricting a column to a date, or to one of a fixed set of values - prevents the problem instead of detecting it later. This is the same principle as input validation in software, which you will meet again in security: it is always cheaper to refuse bad data than to clean it.\n\n' +
          'Sorting, filtering and pivoting all assume this discipline. They are unreliable without it.',
      },
      {
        lessonId: 'garud-m04-l05',
        title: '4.5 Presentation Design',
        duration: '22 mins',
        subject: 'COMPUTER',
        summary: 'Designing slides and charts that transmit information rather than decorate it.',
        content:
          'Every element on a slide either helps the audience understand the point or competes with it. There is no neutral decoration.\n\n' +
          'For text: one idea per slide, and phrases rather than sentences. A slide of full sentences will be read, and reading is faster than listening, so the audience finishes before you and stops paying attention.\n\n' +
          'For charts: choose the form from the question. Comparing categories is a bar chart. Change over time is a line. Parts of a whole, with few parts, is a stacked bar - pie charts are hard to read accurately and worse the more slices they have. Always label the axes and state the units; a chart whose numbers cannot be identified is a picture, not evidence.\n\n' +
          'Contrast and size encode importance. If everything is bold, nothing is. If the key number is the same size as the footnote, the audience has to work out what matters, and some of them will get it wrong.\n\n' +
          'Consistency across slides is not aesthetics - it means the audience learns your visual language once instead of re-learning per slide.',
      },
      {
        lessonId: 'garud-m04-l06',
        title: '4.6 Productivity Automation Concepts',
        duration: '22 mins',
        subject: 'COMPUTER',
        summary: 'Recognising work a machine should be doing, and what it costs to hand it over.',
        content:
          'Automation is worth it when a task is repetitive, rule-based and frequent enough that the setup pays for itself. Getting any of those three wrong produces automation that costs more than it saves.\n\n' +
          'Repetitive means the steps are the same each time. Rule-based means the decisions can be written down - if a step requires judgement that changes with context, that step stays human. Frequent enough is arithmetic: a task taking five minutes, done weekly, costs about four hours a year, so an hour of setup is clearly worth it, and a week of setup clearly is not.\n\n' +
          'The hidden costs are real. Automated work fails silently unless you design in a way to notice. It encodes today\'s rules, so when the rules change the automation is quietly wrong rather than obviously broken. And it becomes something only its author understands unless it is documented.\n\n' +
          'Start by automating the parts you can verify at a glance. In YODDHA you will write scripts that do this properly; the judgement about what is worth automating is what matters first.',
      },
    ],
    quizzes: [
      {
        quizId: 'garud-m04-q01',
        title: 'Computer Productivity Assessment',
        subject: 'COMPUTER',
        timeLimitMins: 15,
        pointsReward: 60,
        questions: [
          {
            questionId: 'q1',
            question: 'You copy a formula down a column and every result after the first is wrong. What is the most likely cause?',
            options: [
              'The spreadsheet needs to be recalculated manually',
              'A reference that should have been absolute is relative, so it shifted with the copy',
              'The column is formatted as text',
              'The file is too large',
            ],
            correctIndex: 1,
            explanation:
              'Relative references shift as a formula is copied. A reference to a fixed lookup table or constant must be absolute, or each copied row points somewhere slightly different.',
          },
          {
            questionId: 'q2',
            question: 'Why is marking a heading with a Heading style better than just making it bold and large?',
            options: [
              'It uses less file space',
              'It gives the document real structure, so contents, navigation and cross-references work',
              'Bold text cannot be printed reliably',
              'It prevents others from editing the document',
            ],
            correctIndex: 1,
            explanation:
              'A style says what the text is; formatting only says how it looks. Real structure is what lets a table of contents generate itself and a long document be restyled in one action.',
          },
          {
            questionId: 'q3',
            question: 'A dataset has a single column containing full postal addresses. What problem will this cause first?',
            options: [
              'The file will not open',
              'It cannot be sorted or filtered by city, because the cell holds several facts',
              'Addresses cannot be stored as text',
              'The column will exceed the maximum width',
            ],
            correctIndex: 1,
            explanation:
              'One fact per cell is the rule. Splitting at entry costs seconds; splitting after the fact costs hours and introduces errors.',
          },
          {
            questionId: 'q4',
            question: 'You need to show how a single value changed over twelve months. Which chart form fits?',
            options: ['Pie chart', 'Line chart', 'Stacked bar per month', 'Scatter plot of month against itself'],
            correctIndex: 1,
            explanation:
              'Change over time is a line. Bars compare categories; pie charts show parts of a whole and become hard to read accurately as slices multiply.',
          },
          {
            questionId: 'q5',
            question: 'A five-minute manual task is done once a week. Roughly how much time does it cost per year, and what does that imply?',
            options: [
              'About 4 hours - an hour of automation setup is clearly worth it',
              'About 30 minutes - automation is never worth it',
              'About 40 hours - any amount of setup is justified',
              'It cannot be estimated',
            ],
            correctIndex: 0,
            explanation:
              'Five minutes weekly is roughly 260 minutes, a bit over four hours a year. That makes an hour of setup obviously worthwhile and a week of setup obviously not - the arithmetic is the decision.',
          },
          {
            questionId: 'q6',
            question: 'Which is the most dangerous habit in a spreadsheet, because the error is invisible?',
            options: [
              'Using too many colours',
              'Typing a number directly into a cell that should be computed by a formula',
              'Sorting the data',
              'Adding a chart',
            ],
            correctIndex: 1,
            explanation:
              'A hard-typed value looks identical to a computed one and stops updating when its inputs change, so the sheet quietly reports a stale number that nobody has reason to question.',
          },
        ],
      },
    ],
    tasks: [],
  },

  {
    moduleId: 'garud-m05',
    title: 'Month 3 · Operating Systems',
    order: 5,
    subject: 'COMPUTER',
    lessons: [
      {
        lessonId: 'garud-m05-l01',
        title: '5.1 Operating System Architecture',
        duration: '24 mins',
        subject: 'COMPUTER',
        summary: 'What an operating system is for, and the kernel/user-space boundary that matters later.',
        content:
          'An operating system exists to share one set of hardware between many programs that do not trust each other, and to hide the differences between hardware from the programs using it.\n\n' +
          'It does that through a boundary. The kernel runs with full access to the hardware. Everything else - your browser, your editor, the program you wrote - runs in user space with no direct access at all. When a program needs to read a file or send a packet, it asks the kernel through a system call.\n\n' +
          'That boundary is the foundation of every security control you will study in this stage. Permissions, isolation between users, the reason a compromised application is not automatically a compromised machine: all of it depends on that line holding.\n\n' +
          'It is also why privilege escalation is such a significant class of attack. An attacker with user-level access who finds a way across the boundary has gone from running a program to owning the machine.',
      },
      {
        lessonId: 'garud-m05-l02',
        title: '5.2 Processes and Applications',
        duration: '22 mins',
        subject: 'COMPUTER',
        summary: 'Programs, processes, parents and children - and why the tree matters in an investigation.',
        content:
          'A program is a file on disk. A process is that program running, with its own memory, its own identity, and an owner.\n\n' +
          'Every process is started by another process, so they form a tree. That parentage is one of the most useful things in an investigation. A word processor is an ordinary thing to see running. A word processor whose child process is a command shell is not ordinary at all, and that relationship - not either process on its own - is the signal.\n\n' +
          'Processes have state: running, sleeping, waiting on input or output, stopped. A process consuming a whole CPU core is doing something; a process using no CPU but holding a network connection open may be more interesting.\n\n' +
          'Each process runs as a user, and that determines what it may touch. A process running as an administrative account can do administrative things - which is why what an attacker can do depends less on what they ran than on who they ran it as.',
      },
      {
        lessonId: 'garud-m05-l03',
        title: '5.3 Users and Permissions',
        duration: '24 mins',
        subject: 'COMPUTER',
        summary: 'Identity, groups and least privilege as the operating system implements them.',
        content:
          'The operating system decides what may happen by asking who is asking. Every process carries a user identity, and every file carries rules about which identities may read, write or execute it.\n\n' +
          'Groups exist so those rules do not have to name individuals. Permissions are granted to a group, and membership of the group is managed separately - which is what makes it practical to revoke someone\'s access in one action rather than auditing every file.\n\n' +
          'Least privilege is the principle that an account should hold exactly the rights its work requires and no more. It is routinely violated for convenience: working day-to-day as an administrator is easier, right up until a program you did not intend to run inherits that authority.\n\n' +
          'Administrative accounts should be separate from daily-use accounts, and elevation should be deliberate and occasional. This is the single highest-value habit in this module, and the one most often skipped.',
      },
      {
        lessonId: 'garud-m05-l04',
        title: '5.4 File Systems',
        duration: '22 mins',
        subject: 'COMPUTER',
        summary: 'How files are actually stored, and why "deleted" usually is not.',
        content:
          'A file system keeps two separate things: the contents of files, and the metadata describing them - name, size, owner, permissions, and timestamps.\n\n' +
          'Deleting a file normally removes the metadata entry and marks its space reusable. The contents stay on the disk until something else overwrites them. This is why deleted files are frequently recoverable, and it is the basis of a large part of digital forensics, which you meet in month 6.\n\n' +
          'Timestamps usually record when a file was created, last modified and last accessed. They are enormously useful in an investigation and they are not evidence on their own, because several of them can be altered. A timestamp that disagrees with other timestamps is a question, not a conclusion.\n\n' +
          'Understanding this now matters for two reasons. It tells you why secure deletion is a separate operation from deletion. And it tells you why, when preserving evidence later, you work from a copy and avoid touching the original.',
      },
      {
        lessonId: 'garud-m05-l05',
        title: '5.5 System Monitoring',
        duration: '22 mins',
        subject: 'COMPUTER',
        summary: 'Reading what a machine is doing, and knowing what normal looks like.',
        content:
          'Monitoring answers "what is this machine doing right now?" - through processes, CPU and memory use, disk activity, and open network connections.\n\n' +
          'The single most important idea is baseline. An alert saying CPU is at 80% means nothing unless you know whether that is Tuesday afternoon as usual or unprecedented. Investigators who know what normal looks like spot abnormal quickly; those who do not chase ordinary behaviour and miss the real thing.\n\n' +
          'Four questions cover most situations. What is using the CPU? What is using memory, and is it growing steadily in a way that suggests a leak? What is filling the disk? And what network connections are open, to where, owned by which process?\n\n' +
          'That last question is where monitoring meets security. A process you do not recognise holding a connection to an address you do not recognise is the kind of observation that starts an investigation, and you will do exactly that in month 5.',
      },
      {
        lessonId: 'garud-m05-l06',
        title: '5.6 Command Line Fundamentals',
        duration: '26 mins',
        subject: 'COMPUTER',
        summary: 'Why the command line exists, and the handful of ideas that make it powerful.',
        content:
          'The command line is not a harder version of the graphical interface. It is a different tool with two properties the GUI lacks: it is exact, and it composes.\n\n' +
          'Exact means a command is a written record of precisely what was done. It can be pasted into a report, repeated identically next month, or checked by someone else. "I clicked through some menus" cannot.\n\n' +
          'Composes means small tools chain together. One command lists files, another filters lines, another counts them - and joined by a pipe they answer a question none of them answers alone. This is where the power comes from, not from any individual command.\n\n' +
          'A working core is: navigating directories, listing files with details, viewing and searching file contents, filtering text, and inspecting running processes. That is enough to investigate a machine.\n\n' +
          'Two cautions. The command line generally does not ask "are you sure?", and it usually has no undo. Read a destructive command twice before running it, and prefer commands that show you what they would do before commands that do it.',
      },
    ],
    quizzes: [],
    tasks: [
      {
        taskId: 'garud-m05-a01',
        title: 'Command-Line System Investigation',
        type: 'Activity',
        subject: 'COMPUTER',
        urgency: 'high',
        pointsReward: 60,
        dueOffsetDays: 14,
        iconName: 'Terminal',
        description:
          'Investigate a machine you own, using the command line only, and report what it is doing.\n\n' +
          'Produce answers to all five, each with the exact command you ran and its relevant output:\n' +
          '1. Which five processes are using the most CPU or memory, and who owns each?\n' +
          '2. How much disk space is free, and which directory is consuming the most?\n' +
          '3. What network connections are currently open, and which process owns each?\n' +
          '4. Find every file in your documents area modified in the last seven days.\n' +
          '5. Identify one process you cannot immediately account for, and describe how you would establish what it is - including its parent process.\n\n' +
          'Submit a report with, for each question, the command, the output, and one sentence of interpretation.\n\n' +
          'Assessed on: whether the commands actually answer the questions asked, whether the interpretation shows you read the output rather than pasting it, and whether question 5 shows genuine reasoning rather than a guess. Do not run destructive commands.',
      },
    ],
  },

  {
    moduleId: 'garud-m06',
    title: 'Month 3 · Networking Fundamentals',
    order: 6,
    subject: 'CYBERSECURITY',
    lessons: [
      {
        lessonId: 'garud-m06-l01',
        title: '6.1 What Is a Network?',
        duration: '20 mins',
        subject: 'CYBERSECURITY',
        summary: 'Layers, addresses and the idea that every message is handled by machines you do not control.',
        content:
          'A network is a set of agreements that let machines which know nothing about each other exchange messages reliably.\n\n' +
          'Those agreements are arranged in layers, each solving one problem and using the layer below. The physical layer moves signals. The link layer moves frames between directly connected devices. The network layer moves packets between networks. The transport layer turns packets into an ordered, reliable stream. The application layer is where your program lives.\n\n' +
          'Layering is why you can write a program that fetches a web page without knowing whether it travels over fibre or Wi-Fi, and why a fault can be isolated - a problem is usually in one layer.\n\n' +
          'The security consequence is the one to hold on to. Your message is handled, in turn, by a series of devices you neither own nor trust. Everything in network security follows from that: encryption because the path is untrusted, authentication because the other end is unproven, and monitoring because you cannot see most of the journey.',
      },
      {
        lessonId: 'garud-m06-l02',
        title: '6.2 IP Addresses',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Addressing, networks and hosts, and what public versus private actually means.',
        content:
          'An IP address identifies an interface on a network. IPv4 writes it as four numbers from 0 to 255; IPv6 is longer because the IPv4 space ran out.\n\n' +
          'An address has two parts: which network, and which host on it. The split is set by the subnet mask, and it is what lets a router decide whether a destination is local - deliver directly - or remote - forward towards it. Understanding that one decision explains most of routing.\n\n' +
          'Some ranges are private and never routed on the public internet: 10.x.x.x, 172.16-31.x.x and 192.168.x.x. Home and office networks use these, and a device on one reaches the internet through address translation at the router.\n\n' +
          'For investigation this matters constantly. A log line showing a private address is telling you about something inside the network; a public address is something outside it. Confusing the two sends an investigation in entirely the wrong direction, and it is a mistake that is easy to make quickly.',
      },
      {
        lessonId: 'garud-m06-l03',
        title: '6.3 MAC Addresses',
        duration: '18 mins',
        subject: 'CYBERSECURITY',
        summary: 'Hardware addressing, its local scope, and why it is weak evidence of identity.',
        content:
          'A MAC address identifies a network interface at the link layer. It is assigned by the manufacturer and written as six pairs of hexadecimal digits.\n\n' +
          'Its scope is strictly local. MAC addresses are used to deliver frames between devices on the same network segment and are replaced at every router hop. A MAC address from three networks away never reaches you, which is precisely why it is useful locally and useless remotely.\n\n' +
          'The first half identifies the manufacturer, which occasionally helps identify what a device is when nothing else does.\n\n' +
          'It is weak evidence of identity because it can be changed in software in seconds. Treat a MAC address as a useful correlating detail, never as proof that a particular device was present. Access control that relies on MAC filtering alone provides very little security for the same reason - it is a list of names anyone can adopt.',
      },
      {
        lessonId: 'garud-m06-l04',
        title: '6.4 TCP/IP',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'Connections, handshakes, and the difference between TCP and UDP in practice.',
        content:
          'IP gets a packet towards a destination and promises nothing else - packets may be lost, duplicated or arrive out of order. TCP builds reliability on top of that.\n\n' +
          'A TCP connection opens with a three-way handshake: one side sends SYN, the other replies SYN-ACK, the first sends ACK. Only then does data flow. TCP numbers every byte, acknowledges what arrived, and retransmits what did not, so the application sees an ordered, reliable stream.\n\n' +
          'UDP does none of this. It sends a datagram and is finished. That makes it faster and lighter, which is why it suits video calls and DNS, where a late packet is worth less than a fast one.\n\n' +
          'The security relevance is direct. The handshake is why a scanner can learn whether a port is open without completing a connection, and why a flood of half-open connections is a recognised denial-of-service technique. And because UDP requires no handshake, its source address is trivially forged - which is the basis of amplification attacks.',
      },
      {
        lessonId: 'garud-m06-l05',
        title: '6.5 DNS',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'How names become addresses, and why DNS records are so informative in an investigation.',
        content:
          'DNS translates names people can remember into addresses machines can route to. Your machine asks a resolver; the resolver walks the hierarchy - root, then top-level domain, then the domain\'s own servers - and returns an answer, which is then cached for a period the record specifies.\n\n' +
          'Caching is why a DNS change takes time to take effect everywhere, and why the time-to-live value matters operationally.\n\n' +
          'In security work DNS is disproportionately useful. Nearly every connection begins with a lookup, so DNS logs record intent even when the connection itself is encrypted. A machine resolving a domain registered yesterday, or resolving hundreds of names in a pattern no human would produce, is visible in DNS before anything else shows it.\n\n' +
          'It is also attacked. Poisoning a cache sends users to the wrong address; a domain that closely resembles a real one supports phishing; and DNS traffic can be abused as a covert channel to carry data out of a network that blocks everything else.',
      },
      {
        lessonId: 'garud-m06-l06',
        title: '6.6 HTTP and HTTPS',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Requests, responses, status codes, and exactly what TLS does and does not protect.',
        content:
          'HTTP is a request-response protocol. A client sends a method - GET to retrieve, POST to submit - with a path and headers; the server replies with a status code, headers and usually a body.\n\n' +
          'Status codes group by first digit: 2xx succeeded, 3xx redirected, 4xx the client got it wrong, 5xx the server failed. Reading them accurately saves a great deal of time, because a 403 and a 404 point at entirely different problems.\n\n' +
          'HTTPS is HTTP inside TLS, and it provides three things: the content is encrypted in transit, it cannot be modified undetected, and the server\'s identity is verified by a certificate.\n\n' +
          'Be precise about what it does not provide. It does not tell you the site is trustworthy - a criminal can obtain a valid certificate for their own domain, and most phishing sites now have one. It does not hide which site you visited, since the domain is usually visible in the lookup and the handshake. And it protects nothing once the data arrives: a site that receives your password over HTTPS and then stores it carelessly has still lost it.',
      },
      {
        lessonId: 'garud-m06-l07',
        title: '6.7 Ports and Protocols',
        duration: '20 mins',
        subject: 'CYBERSECURITY',
        summary: 'How one machine runs many services, and what an open port tells an attacker.',
        content:
          'A port number lets one address host many services. The IP address gets the packet to the machine; the port decides which program receives it.\n\n' +
          'Convention assigns well-known numbers: 22 for SSH, 25 for mail transfer, 53 for DNS, 80 for HTTP, 443 for HTTPS, 3389 for remote desktop. These are conventions, not rules - a service can run on any port, and deliberately running one somewhere unexpected is a mild obstacle to casual scanning rather than a security measure.\n\n' +
          'A listening port is a program waiting for input from the network, which means it is a way in. Every open port is therefore something to justify: what is listening, does it need to be reachable, and from where?\n\n' +
          'This is the reasoning behind minimising attack surface. The most reliable way to secure a service is not to expose it. When you look at open connections on a machine in the practical work, you are reading exactly this.',
      },
      {
        lessonId: 'garud-m06-l08',
        title: '6.8 Network Troubleshooting',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'Diagnosing a connectivity fault by layer instead of by guesswork.',
        content:
          'Troubleshooting works when it is systematic. The layered model gives you the order: establish where it breaks before deciding why.\n\n' +
          'Work upward. Is the interface up and does it have an address? Can you reach the gateway on your own network? Can you reach an address outside it? Can you resolve a name? Can you connect to the specific service? Each step that succeeds eliminates everything below it.\n\n' +
          'The single most useful diagnostic distinction is between "can reach an IP address but not resolve a name" - DNS - and "can resolve a name but not connect" - routing, firewall or the service itself. Those two findings point in completely different directions, and testing both takes under a minute.\n\n' +
          'Change one thing at a time and record what you changed. Multiple simultaneous changes mean that when it starts working you will not know why, and will not be able to fix it next time.\n\n' +
          'This discipline is the same one that underlies incident response: establish the facts in order, and do not skip to the cause you expect.',
      },
    ],
    quizzes: [
      {
        quizId: 'garud-m06-q01',
        title: 'Networking Fundamentals',
        subject: 'CYBERSECURITY',
        timeLimitMins: 18,
        pointsReward: 70,
        questions: [
          {
            questionId: 'q1',
            question: 'A log entry shows a connection from 192.168.1.42. What does this tell you?',
            options: [
              'The connection came from outside the organisation',
              'The address is private, so the source is inside this network',
              'The address is forged',
              'It is a MAC address, not an IP address',
            ],
            correctIndex: 1,
            explanation:
              '192.168.x.x is a private range and is never routed on the public internet. Mistaking a private address for an external one sends an investigation in entirely the wrong direction.',
          },
          {
            questionId: 'q2',
            question: 'Why is a MAC address weak evidence that a specific device was present?',
            options: [
              'MAC addresses are encrypted',
              'They change every time a device restarts',
              'They can be changed in software in seconds',
              'They are only assigned to wireless devices',
            ],
            correctIndex: 2,
            explanation:
              'A MAC address is trivially spoofed, which is also why MAC filtering provides very little access control - it is a list of names anyone can adopt.',
          },
          {
            questionId: 'q3',
            question: 'What are the three steps of the TCP handshake, in order?',
            options: ['ACK, SYN, SYN-ACK', 'SYN, SYN-ACK, ACK', 'SYN, ACK, FIN', 'GET, 200 OK, CLOSE'],
            correctIndex: 1,
            explanation:
              'SYN, SYN-ACK, ACK. A flood of connections left half-open after the first step is a recognised denial-of-service technique.',
          },
          {
            questionId: 'q4',
            question: 'A site is served over HTTPS with a valid certificate. What does that establish?',
            options: [
              'The site is trustworthy and not malicious',
              'The traffic is encrypted and the server\'s identity is verified for that domain',
              'The site cannot collect your data',
              'The site has been security tested',
            ],
            correctIndex: 1,
            explanation:
              'TLS proves you are talking to the holder of that domain\'s certificate, over an encrypted channel. It says nothing about intent - most phishing sites now have valid certificates.',
          },
          {
            questionId: 'q5',
            question: 'You can reach 8.8.8.8 by IP but no website loads by name. Where is the fault?',
            options: ['Physical cabling', 'Name resolution - DNS', 'The TCP handshake', 'HTTPS certificates'],
            correctIndex: 1,
            explanation:
              'Reaching an address proves routing works. Failing on names isolates the fault to resolution, and distinguishing those two cases takes under a minute.',
          },
          {
            questionId: 'q6',
            question: 'Why is every open, listening port something that should be justified?',
            options: [
              'Open ports slow the machine down',
              'Each one is a program accepting input from the network, so each is a possible way in',
              'Ports above 1024 are always insecure',
              'Operating systems limit the number of ports',
            ],
            correctIndex: 1,
            explanation:
              'A listening port is a program waiting for network input. Minimising attack surface follows directly: the most reliable way to secure a service is not to expose it.',
          },
          {
            questionId: 'q7',
            question: 'Why are DNS logs unusually valuable when most traffic is encrypted?',
            options: [
              'DNS traffic is always encrypted too',
              'Nearly every connection starts with a lookup, so DNS records intent even when content is hidden',
              'DNS stores the full contents of each request',
              'DNS logs cannot be tampered with',
            ],
            correctIndex: 1,
            explanation:
              'The lookup happens before the encrypted connection. A machine resolving a domain registered yesterday is visible in DNS before anything else shows it.',
          },
          {
            questionId: 'q8',
            question: 'What is the practical consequence of UDP having no handshake?',
            options: [
              'UDP cannot carry useful data',
              'The source address is easily forged, which enables amplification attacks',
              'UDP is always slower than TCP',
              'UDP guarantees delivery order',
            ],
            correctIndex: 1,
            explanation:
              'With nothing to establish that the sender is who they claim, a forged source address causes the reply to be sent to a victim - the basis of amplification.',
          },
        ],
      },
    ],
    tasks: [],
  },
];

export default FOUNDATION;
