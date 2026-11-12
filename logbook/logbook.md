# Logbook

## Meeting (26 May 2026)

Present: Lingxin Kong (student), Chuan Ju (student), Professor Maiko Schaffrath (supervisor), Professor Cesar A. Quilodran Casas (supervisor)

Key points discussed:

- This was the kick-off meeting for the ClimateTech startup-investor matching project.
- The supervisors introduced the project background and explained that the work will focus on improving an existing investor matching system rather than building a new application from scratch.
- We looked at the current user interface and walked through how the existing matching workflow is presented to users.
- The supervisors showed us the current baseline algorithm at a high level, including how the tool ranks investors and displays match results.
- We discussed the fact that the project will be completed by two students, so the work needs to be split clearly while still leaving room for shared decisions.
- The supervisors asked us to think about which parts of the project we are most interested in, especially the data/evaluation side versus the algorithm/system side.

Feedback received:

- The project should start from the existing baseline and improve it in a measurable way.
- The current interface is already available, so the main focus should be on the matching logic, the data used by the algorithm, and how to evaluate whether the ranking improves.
- We were advised to come back with a practical weekly plan rather than a vague list of possible ideas.
- The supervisors encouraged us to decide on a sensible division of work soon, so that both students can make progress in parallel.

Work plan before next meeting:

- Review the existing matching system and identify the files that are most relevant to the algorithm and the user-facing matching flow.
- Think through a clear split of responsibilities between Chuan and me.
- Draft a weekly project plan from 8 June to 2 August, with separate tasks for each student and shared checkpoints.
- Prepare questions for the next meeting about data access, evaluation criteria, and what the supervisors expect from the first implementation milestone.

## Meeting (5 June 2026)

Present: Lingxin Kong (student), Chuan Ju (student), Professor Maiko Schaffrath (supervisor), Professor Cesar A. Quilodran Casas (supervisor)

Key points discussed:

- This was our second project meeting. We used it to check whether the weekly plan and the proposed division of work made sense before starting the main implementation period.
- We confirmed that the project should build on the current matching code rather than replace the whole system. The existing website is mainly there to show the results, so our work should stay focused on the matching mechanism, the data behind it, and the evaluation.
- We discussed the split between the two students. Chuan will focus more on data quality, evaluation, labelled test cases, and evidence that the algorithm is improving. I will focus more on understanding and improving the matching algorithm, the scoring logic, and the system workflow.
- We talked about the current introduction workflow. At the moment, if several startups are matched to the same investor, that investor could receive several separate introduction emails. Professor Schaffrath pointed out that this may not be the best experience for investors once the system is tested with more users.
- A possible testing setup was suggested: choose a small group of investors, for example around 20, and show them two different matched startup lists. The investors could then say which list is a better fit and give short feedback. That feedback would be useful for the research as well as for tuning the algorithm.

Feedback received:

- The supervisors were happy with the general direction of our plan and the split of responsibilities.
- We should make changes to the existing matching mechanism in a controlled way, so that each improvement can be compared with the baseline.
- The evaluation should not only rely on whether a score looks higher. We need some human feedback or labelled judgements to check whether the ranking is actually better.
- The investor side of the workflow matters. A good matching system should avoid sending too many separate emails to the same investor, because that could make the tool less useful in practice.
- The testing plan should be realistic. A small investor review, with two lists to compare, is more practical than trying to run a large experiment too early.

Work plan before next meeting:

- Start from the agreed weekly plan beginning on 8 June and keep both individual workstreams active each week.
- Review the existing matching code in detail and identify where the baseline scores are calculated.
- Ask for or confirm access to the data needed for testing, especially Airtable investor data, startup submissions, and any existing feedback records.
- Define a first baseline run so that later algorithm changes can be compared against the same starting point.
- Begin planning how investor feedback could be collected and turned into useful evaluation labels.

## Meeting (19 June 2026)

Present: Lingxin Kong (student), Chuan Ju (student), Professor Maiko Schaffrath (supervisor)

Key points discussed:

- This was a short progress check after the project plan had been agreed.
- Chuan explained his first-week focus on the data and evaluation side of the project. He had started mapping the current Undaunted matching baseline, the data fields used by the matcher, how results are saved, and how labelled examples could later support evaluation.
- I explained that my first task was still to understand the current matching logic before changing it. I was looking at the recommendation reasons and how they relate to the semantic scoring path.
- We discussed that the first couple of weeks should be used to understand what the current system produces, then decide what a good improvement would look like.
- Professor Schaffrath asked whether we needed any help at this stage. We did not have an immediate blocker, but agreed that questions could be sent in the chat if they came up.

Feedback received:

- Before doing data labelling, Chuan should avoid looking at the existing score for a match. Professor Schaffrath pointed out that seeing the current score could bias the labels.
- The labelling process should be kept separate from the current ranking output as much as possible, so later evaluation is more trustworthy.
- It is still too early to judge the final algorithm direction. We should first understand the baseline and then come back to discuss what good results look like and how to assess them.
- If we get stuck on data access, evaluation setup, or project direction, we should raise the question early rather than wait for the next formal meeting.

Work plan before next meeting:

- Continue mapping the baseline matching workflow and the fields used in the current scoring process.
- Keep the algorithm work and data/evaluation work moving in parallel.
- Start thinking about how recommendation reasons can be checked against the scores and the semantic scoring output.
- For data labelling, avoid using the existing score as a guide.
- Prepare clearer questions about what a good evaluation result should look like once we have seen more of the baseline output.

## Meeting (3 July 2026)

Present: Lingxin Kong (student), Chuan Ju (student), Professor Maiko Schaffrath (supervisor), Professor Cesar A. Quilodran Casas (supervisor)

Key points discussed:

- We had a practical walkthrough of the Replit workspace used for the existing application. We looked at how to preview changes in the development environment and how the investor matching feature sits inside the full app.
- The supervisors showed us the available project files, secrets and database views. We also looked at the separate development and production databases.
- We discussed the GitHub synchronisation inside Replit, including how changes can be staged and committed from the workspace.
- Professor Schaffrath explained that the republish action sends changes directly to production. Real founders are using the live application, so we must not publish anything from the development workspace.
- We were encouraged to explore the files and use a new task to draft a plan, but to check the plan with the supervisors before asking the Replit agent to build anything.

Feedback received:

- Development work must stay separate from the live application. We should not use the republish action or make unreviewed production changes.
- Before building a new feature, we should write down the proposed change and confirm that the plan makes sense.
- Replit can help us inspect and test the existing system, but we still need to understand which files, data and environment each change affects.
- We should ask questions as soon as they come up, especially if we are unsure whether an action could affect production.

Work plan before next meeting:

- Explore the Replit development workspace and identify the files connected to investor matching.
- Confirm which data and services belong to development and which belong to production.
- Draft a clear implementation plan before making the next algorithm change and send it to the supervisors for a quick check.
- Keep the GitHub repository in sync with reviewed work, without publishing the application.

## Meeting (17 July 2026)

Present: Lingxin Kong (student), Chuan Ju (student), Professor Maiko Schaffrath (supervisor)

Key points discussed:

- This was a short progress and scheduling check. We did not have an immediate technical blocker or a specific question that needed a decision during the meeting.
- Professor Schaffrath told us that she would be unavailable from 6 to 14 August and again from 27 August to 1 September.
- For anything genuinely urgent during those periods, she offered a WhatsApp contact, although the preference was to resolve likely questions in advance where possible.
- We agreed to continue the planned implementation and evaluation work and raise questions before the unavailable periods.

Feedback received:

- We should not wait until the last minute to raise questions that could block the project.
- The project should continue during the supervisors' unavailable periods, so our next tasks and decisions need to be clear beforehand.
- Urgent contact is available if necessary, but routine questions should be collected and discussed in advance.

Work plan before next meeting:

- Continue the matching implementation and evaluation work already in progress.
- Collect any questions that need supervisor input and send them before 6 August.
- Keep the report, code and evaluation evidence moving in parallel so that the August schedule does not create a bottleneck.

## Meeting (3 August 2026)

Present: Lingxin Kong (student), Chuan Ju (student), Professor Maiko Schaffrath (supervisor), Professor Cesar A. Quilodran Casas (supervisor)

Key points discussed:

- Chuan and I gave a progress update on the code and evaluation work. The supervisors explained that a brief verbal update was not enough for them to judge the implementation in detail, but we could share the code if we wanted a closer, high-level review.
- Professor Schaffrath focused on the reliability of the evaluation. She asked us to be precise about what the manual feedback measures and not claim that it predicts more than the data can support.
- We discussed improving the evidence beyond feedback on two startups with limited information. Feedback from more startups and more than one reviewer would make the evaluation more useful, although it would still have limits.
- Professor Quilodran Casas pointed out that Replit's coding agent may make implementation decisions on our behalf. Because we are responsible for the software, we need to understand and justify those decisions ourselves.
- This is especially important for the viva. We may be asked why a method, metric or implementation choice was used, so the answer cannot simply be that the agent generated it.

Feedback received:

- The evaluation claims must match the strength of the evidence. Manual judgements from a small sample should not be presented as proof that the matcher will perform the same way in general use.
- Where possible, we should collect feedback across more startup cases and from multiple reviewers.
- If we want detailed feedback on the implementation, we need to share the relevant code rather than rely on a short meeting update.
- I need to understand every important code and design choice, including changes suggested or written by the Replit agent, and be ready to explain them in the viva and report.

Work plan before next meeting:

- Expand the evaluation beyond the first two startup cases where the available data allows it.
- Seek more than one judgement for the manual review and record the limits of the resulting labels.
- Review the implementation line by line and document the reason for each important design, scoring and evaluation decision.
- Share the relevant code with the supervisors if a high-level review would help before submission.
- Make sure the final report and viva distinguish observed results from claims that the current sample cannot support.
