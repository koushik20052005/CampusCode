// ============================================================
// CAMPUSCODE DEFAULT HACKATHON RULES
// ============================================================

const DEFAULT_HACKATHON_RULES = [
  {
    id: 1,
    category: "Eligibility",
    rule: "Only registered participants who satisfy the eligibility requirements of the hackathon may participate."
  },
  {
    id: 2,
    category: "Eligibility",
    rule: "Every participant must use their own CampusCode account."
  },
  {
    id: 3,
    category: "Eligibility",
    rule: "Participants must provide accurate registration information."
  },
  {
    id: 4,
    category: "Eligibility",
    rule: "Participants must comply with any college, institution, or organizer eligibility requirements."
  },
  {
    id: 5,
    category: "Eligibility",
    rule: "The organizer may verify participant eligibility before allowing participation."
  },

  {
    id: 6,
    category: "Registration",
    rule: "Participants must complete registration before the published registration deadline."
  },
  {
    id: 7,
    category: "Registration",
    rule: "A participant may not create multiple accounts to obtain additional participation opportunities."
  },
  {
    id: 8,
    category: "Registration",
    rule: "Registration information must not contain fraudulent or misleading information."
  },
  {
    id: 9,
    category: "Registration",
    rule: "The organizer may reject registrations that do not satisfy the published requirements."
  },
  {
    id: 10,
    category: "Registration",
    rule: "Once registration closes, new participants may only be added if the organizer permits it."
  },

  {
    id: 11,
    category: "Teams",
    rule: "Participants may form teams according to the team-size limit configured for the hackathon."
  },
  {
    id: 12,
    category: "Teams",
    rule: "A participant may belong to only one team for a particular hackathon."
  },
  {
    id: 13,
    category: "Teams",
    rule: "Every team member must be a registered participant of the same hackathon."
  },
  {
    id: 14,
    category: "Teams",
    rule: "A participant cannot join another team while already belonging to a team in the same hackathon."
  },
  {
    id: 15,
    category: "Teams",
    rule: "The team leader is responsible for managing the team unless the organizer specifies another process."
  },
  {
    id: 16,
    category: "Teams",
    rule: "Team names must not contain abusive, offensive, discriminatory, or misleading content."
  },
  {
    id: 17,
    category: "Teams",
    rule: "Teams must not impersonate another team, organization, company, or institution."
  },
  {
    id: 18,
    category: "Teams",
    rule: "The organizer may require teams to update incomplete or incorrect team information."
  },
  {
    id: 19,
    category: "Teams",
    rule: "Team membership changes must follow the rules and deadlines published by the organizer."
  },
  {
    id: 20,
    category: "Teams",
    rule: "A team cannot exceed the maximum team size configured for the hackathon."
  },

  {
    id: 21,
    category: "Projects",
    rule: "Each team must develop a project relevant to the hackathon theme or problem statement."
  },
  {
    id: 22,
    category: "Projects",
    rule: "The project description submitted by a team must accurately represent the project."
  },
  {
    id: 23,
    category: "Projects",
    rule: "Teams are responsible for the functionality and correctness of their submitted project."
  },
  {
    id: 24,
    category: "Projects",
    rule: "Teams should clearly explain the problem, solution, features, technology, and expected impact of their project."
  },
  {
    id: 25,
    category: "Projects",
    rule: "Projects must not intentionally contain malicious functionality."
  },
  {
    id: 26,
    category: "Projects",
    rule: "Teams are responsible for testing their project before submission."
  },
  {
    id: 27,
    category: "Projects",
    rule: "Project information must not intentionally misrepresent the team's actual work."
  },
  {
    id: 28,
    category: "Projects",
    rule: "Teams must follow any technology restrictions specified by the organizer."
  },
  {
    id: 29,
    category: "Projects",
    rule: "Teams should provide working links when a repository or live demonstration is required."
  },
  {
    id: 30,
    category: "Projects",
    rule: "Teams are responsible for maintaining access to repositories and demonstrations submitted for evaluation."
  },

  {
    id: 31,
    category: "Submissions",
    rule: "Submissions must be completed through the official CampusCode submission workflow when required."
  },
  {
    id: 32,
    category: "Submissions",
    rule: "Teams must submit all mandatory fields and materials requested for the active round."
  },
  {
    id: 33,
    category: "Submissions",
    rule: "Submitted information must be accurate and complete."
  },
  {
    id: 34,
    category: "Submissions",
    rule: "Teams should verify their submission before the deadline."
  },
  {
    id: 35,
    category: "Submissions",
    rule: "Late submissions are not accepted unless the organizer explicitly extends the deadline."
  },
  {
    id: 36,
    category: "Submissions",
    rule: "Teams must not submit another team's project as their own."
  },
  {
    id: 37,
    category: "Submissions",
    rule: "A team should submit only materials relevant to the current round."
  },
  {
    id: 38,
    category: "Submissions",
    rule: "The organizer may reject incomplete submissions."
  },
  {
    id: 39,
    category: "Submissions",
    rule: "The organizer may request clarification about a submitted project."
  },
  {
    id: 40,
    category: "Submissions",
    rule: "After a submission deadline, modifications are subject to the organizer's published rules."
  },

  {
    id: 41,
    category: "Rounds",
    rule: "Each hackathon round has its own requirements and deadline."
  },
  {
    id: 42,
    category: "Rounds",
    rule: "Teams must satisfy the requirements of the current round before progressing to a later round."
  },
  {
    id: 43,
    category: "Rounds",
    rule: "Round progression is controlled by the hackathon organizer or authorized administrator."
  },
  {
    id: 44,
    category: "Rounds",
    rule: "A team that does not satisfy the requirements of a round may not progress."
  },
  {
    id: 45,
    category: "Rounds",
    rule: "The active round and its requirements should be treated as the current participation requirements."
  },
  {
    id: 46,
    category: "Rounds",
    rule: "Organizers may publish different evaluation criteria for different rounds."
  },
  {
    id: 47,
    category: "Rounds",
    rule: "Participants must follow the submission format specified for the active round."
  },
  {
    id: 48,
    category: "Rounds",
    rule: "A round may require additional project information or demonstration material."
  },
  {
    id: 49,
    category: "Rounds",
    rule: "The organizer may close a round after its published deadline."
  },
  {
    id: 50,
    category: "Rounds",
    rule: "The hackathon schedule published by the organizer is the source for exact round dates and times."
  },

  {
    id: 51,
    category: "Deadlines",
    rule: "Participants must monitor the hackathon schedule for important deadlines."
  },
  {
    id: 52,
    category: "Deadlines",
    rule: "Participants are responsible for submitting their work before the applicable deadline."
  },
  {
    id: 53,
    category: "Deadlines",
    rule: "Technical problems on the participant's side do not automatically extend a deadline."
  },
  {
    id: 54,
    category: "Deadlines",
    rule: "Deadline extensions may only be granted by the authorized organizer."
  },
  {
    id: 55,
    category: "Deadlines",
    rule: "An extension announced by the organizer applies according to the organizer's announcement."
  },

  {
    id: 56,
    category: "Technology",
    rule: "Teams may use technologies permitted by the organizer."
  },
  {
    id: 57,
    category: "Technology",
    rule: "Open-source libraries and frameworks may be used unless prohibited by the specific hackathon rules."
  },
  {
    id: 58,
    category: "Technology",
    rule: "Third-party APIs may be used when they comply with the applicable hackathon rules."
  },
  {
    id: 59,
    category: "Technology",
    rule: "Teams are responsible for complying with the licenses of third-party software they use."
  },
  {
    id: 60,
    category: "Technology",
    rule: "Teams must not use technology to intentionally attack, disrupt, or damage the CampusCode platform."
  },

  {
    id: 61,
    category: "AI Usage",
    rule: "AI tools may be used for development assistance unless the specific hackathon rules prohibit their use."
  },
  {
    id: 62,
    category: "AI Usage",
    rule: "Teams remain responsible for the correctness of AI-assisted work."
  },
  {
    id: 63,
    category: "AI Usage",
    rule: "Teams remain responsible for ensuring that AI-assisted content does not violate intellectual property rights."
  },
  {
    id: 64,
    category: "AI Usage",
    rule: "AI-generated code must be reviewed and tested by the participating team."
  },
  {
    id: 65,
    category: "AI Usage",
    rule: "Teams must follow any AI-specific restrictions published by the organizer."
  },
  {
    id: 66,
    category: "AI Usage",
    rule: "AI analysis provided by CampusCode is advisory unless the organizer explicitly states otherwise."
  },
  {
    id: 67,
    category: "AI Usage",
    rule: "Organizer decisions are not automatically replaced by AI recommendations."
  },
  {
    id: 68,
    category: "AI Usage",
    rule: "Teams must not use AI to fabricate evidence, credentials, achievements, or project results."
  },
  {
    id: 69,
    category: "AI Usage",
    rule: "Teams are responsible for checking AI-generated information before including it in their project."
  },
  {
    id: 70,
    category: "AI Usage",
    rule: "If an organizer restricts AI usage, teams must follow the organizer's specific restriction."
  },

  {
    id: 71,
    category: "Originality",
    rule: "The submitted project must represent the participating team's work."
  },
  {
    id: 72,
    category: "Originality",
    rule: "Plagiarism is prohibited."
  },
  {
    id: 73,
    category: "Originality",
    rule: "Copying another team's project or submission is prohibited."
  },
  {
    id: 74,
    category: "Originality",
    rule: "Teams must not falsely claim ownership of third-party work."
  },
  {
    id: 75,
    category: "Originality",
    rule: "Third-party assets should be acknowledged when appropriate."
  },
  {
    id: 76,
    category: "Originality",
    rule: "Teams must not intentionally manipulate project evidence to mislead evaluators."
  },
  {
    id: 77,
    category: "Originality",
    rule: "Submitting substantially copied work may result in rejection or disqualification."
  },
  {
    id: 78,
    category: "Originality",
    rule: "Teams should retain evidence of their development process when required by the organizer."
  },
  {
    id: 79,
    category: "Originality",
    rule: "The organizer may request clarification regarding project originality."
  },
  {
    id: 80,
    category: "Originality",
    rule: "Teams must comply with any additional originality requirements published for the hackathon."
  },

  {
    id: 81,
    category: "Intellectual Property",
    rule: "Teams are responsible for ensuring that their project does not intentionally infringe third-party intellectual property rights."
  },
  {
    id: 82,
    category: "Intellectual Property",
    rule: "Teams should review licenses for third-party code, datasets, APIs, images, and other assets."
  },
  {
    id: 83,
    category: "Intellectual Property",
    rule: "Teams should not upload confidential third-party material without authorization."
  },
  {
    id: 84,
    category: "Intellectual Property",
    rule: "The organizer may request information about third-party assets used in a project."
  },
  {
    id: 85,
    category: "Intellectual Property",
    rule: "Project ownership and prize-related rights are subject to the specific hackathon terms."
  },

  {
    id: 86,
    category: "Judging",
    rule: "Projects may be evaluated using criteria published by the organizer."
  },
  {
    id: 87,
    category: "Judging",
    rule: "Different rounds may use different evaluation criteria."
  },
  {
    id: 88,
    category: "Judging",
    rule: "Organizers or authorized judges may review submitted projects."
  },
  {
    id: 89,
    category: "Judging",
    rule: "Teams must provide requested information needed for evaluation."
  },
  {
    id: 90,
    category: "Judging",
    rule: "Evaluation results may depend on the published criteria and organizer review."
  },
  {
    id: 91,
    category: "Judging",
    rule: "AI-generated evaluation may be advisory and does not automatically determine the final result."
  },
  {
    id: 92,
    category: "Judging",
    rule: "The organizer may request a project demonstration when required."
  },
  {
    id: 93,
    category: "Judging",
    rule: "Teams must cooperate with reasonable evaluation requests."
  },
  {
    id: 94,
    category: "Judging",
    rule: "Organizer decisions must follow the published hackathon process."
  },
  {
    id: 95,
    category: "Judging",
    rule: "Final selection and result approval follow the CampusCode organizer/admin workflow."
  },

  {
    id: 96,
    category: "Conduct",
    rule: "Participants must behave respectfully toward other participants, organizers, judges, and staff."
  },
  {
    id: 97,
    category: "Conduct",
    rule: "Harassment is prohibited."
  },
  {
    id: 98,
    category: "Conduct",
    rule: "Threatening behavior is prohibited."
  },
  {
    id: 99,
    category: "Conduct",
    rule: "Discriminatory behavior is prohibited."
  },
  {
    id: 100,
    category: "Conduct",
    rule: "Abusive or offensive behavior may result in disciplinary action."
  },

  {
    id: 101,
    category: "Security",
    rule: "Participants must not attempt to gain unauthorized access to CampusCode systems."
  },
  {
    id: 102,
    category: "Security",
    rule: "Participants must not attack or intentionally disrupt CampusCode services."
  },
  {
    id: 103,
    category: "Security",
    rule: "Participants must keep their account credentials secure."
  },
  {
    id: 104,
    category: "Security",
    rule: "Passwords, API keys, private keys, access tokens, and other secrets must not be included in public submissions."
  },
  {
    id: 105,
    category: "Security",
    rule: "Teams are responsible for securing their own repositories and deployments."
  },

  {
    id: 106,
    category: "Privacy",
    rule: "Participants should not submit unnecessary personal information in project materials."
  },
  {
    id: 107,
    category: "Privacy",
    rule: "Teams must handle personal data used in their project responsibly."
  },
  {
    id: 108,
    category: "Privacy",
    rule: "Sensitive credentials must not be uploaded to CampusCode submissions."
  },
  {
    id: 109,
    category: "Privacy",
    rule: "Teams should follow applicable privacy requirements when processing user information."
  },
  {
    id: 110,
    category: "Privacy",
    rule: "The organizer may require teams to remove sensitive information from submitted materials."
  },

  {
    id: 111,
    category: "Disqualification",
    rule: "Plagiarism may result in rejection or disqualification."
  },
  {
    id: 112,
    category: "Disqualification",
    rule: "Cheating may result in rejection or disqualification."
  },
  {
    id: 113,
    category: "Disqualification",
    rule: "Fraudulent information may result in rejection or disqualification."
  },
  {
    id: 114,
    category: "Disqualification",
    rule: "Unauthorized access attempts may result in removal from the hackathon."
  },
  {
    id: 115,
    category: "Disqualification",
    rule: "Serious violations of published hackathon rules may result in disqualification."
  },

  {
    id: 116,
    category: "Prizes",
    rule: "Prize eligibility is determined according to the published hackathon terms."
  },
  {
    id: 117,
    category: "Prizes",
    rule: "A team must satisfy all applicable requirements to receive a prize."
  },
  {
    id: 118,
    category: "Prizes",
    rule: "The organizer may verify winner eligibility before prize distribution."
  },
  {
    id: 119,
    category: "Prizes",
    rule: "Prize details and distribution timelines are determined by the organizer."
  },
  {
    id: 120,
    category: "Prizes",
    rule: "If prize information is not specified, RuleBot must direct participants to the organizer."
  },

  {
    id: 121,
    category: "General",
    rule: "Participants should follow official announcements published by the hackathon organizer."
  },
  {
    id: 122,
    category: "General",
    rule: "The organizer may clarify or update hackathon procedures through official announcements."
  },
  {
    id: 123,
    category: "General",
    rule: "RuleBot must not invent a rule that is not contained in the active rule set."
  },
  {
    id: 124,
    category: "General",
    rule: "If a question is not answered by the active rules, RuleBot should clearly state that the information is not specified."
  },
  {
    id: 125,
    category: "General",
    rule: "Exact dates and times must be taken from the active hackathon schedule."
  },
  {
    id: 126,
    category: "General",
    rule: "Organizer-specific rules take precedence over general CampusCode fallback rules."
  },
  {
    id: 127,
    category: "General",
    rule: "Participants should contact the organizer when clarification is required."
  },
  {
    id: 128,
    category: "General",
    rule: "The organizer may apply the published rules consistently across participating teams."
  },
  {
    id: 129,
    category: "General",
    rule: "CampusCode platform functionality does not override specific rules published by the hackathon organizer."
  },
  {
    id: 130,
    category: "General",
    rule: "Final hackathon decisions belong to the authorized organizer or administrator according to the published process."
  }
];

export default DEFAULT_HACKATHON_RULES;