import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputDir = path.join(__dirname, "..", "data");
const outputFile = path.join(outputDir, "ideacheck_projects.json");

const categories = [
  "Artificial Intelligence",
  "Machine Learning",
  "Web Development",
  "Mobile Development",
  "Healthcare",
  "Education",
  "Agriculture",
  "FinTech",
  "Cybersecurity",
  "IoT",
  "Smart City",
  "E-Commerce",
  "Environment",
  "Transportation",
  "Social Impact",
  "Productivity",
  "Entertainment",
  "Tourism",
  "Energy",
  "Food Technology",
];

const domains = {
  "Artificial Intelligence": [
    "AI assistant",
    "intelligent recommendation system",
    "AI document analyzer",
    "AI content generation platform",
    "intelligent automation system",
    "AI-powered prediction platform",
    "natural language processing system",
    "AI decision support system",
  ],

  "Machine Learning": [
    "machine learning prediction system",
    "classification platform",
    "recommendation engine",
    "forecasting system",
    "anomaly detection platform",
    "machine learning analytics system",
    "predictive modeling platform",
  ],

  "Web Development": [
    "web-based management platform",
    "online collaboration system",
    "real-time dashboard",
    "community web platform",
    "online service management system",
    "digital marketplace",
    "web productivity platform",
  ],

  "Mobile Development": [
    "mobile application",
    "Android application",
    "student mobile application",
    "mobile productivity platform",
    "mobile service application",
    "location-based mobile application",
  ],

  Healthcare: [
    "health monitoring platform",
    "patient management system",
    "medical appointment platform",
    "health tracking application",
    "medicine management system",
    "telemedicine platform",
    "digital healthcare assistant",
  ],

  Education: [
    "student learning platform",
    "online education system",
    "learning management application",
    "student productivity platform",
    "digital classroom platform",
    "skill development platform",
    "exam preparation system",
  ],

  Agriculture: [
    "smart farming platform",
    "crop monitoring system",
    "agriculture analytics platform",
    "farmer assistance application",
    "crop recommendation system",
    "smart irrigation system",
    "agricultural marketplace",
  ],

  FinTech: [
    "personal finance platform",
    "expense management system",
    "digital payment platform",
    "financial analytics application",
    "budget management system",
    "investment tracking platform",
    "financial recommendation system",
  ],

  Cybersecurity: [
    "cybersecurity monitoring platform",
    "threat detection system",
    "network security analyzer",
    "phishing detection system",
    "password security platform",
    "security awareness application",
    "intrusion detection system",
  ],

  IoT: [
    "IoT monitoring system",
    "smart device management platform",
    "sensor-based monitoring system",
    "connected device platform",
    "IoT automation system",
    "smart home system",
    "remote sensor analytics platform",
  ],

  "Smart City": [
    "smart city management platform",
    "traffic monitoring system",
    "urban waste management system",
    "smart parking platform",
    "public infrastructure monitoring system",
    "city energy management system",
  ],

  "E-Commerce": [
    "online shopping platform",
    "digital marketplace",
    "product recommendation platform",
    "local seller marketplace",
    "inventory management platform",
    "customer shopping assistant",
  ],

  Environment: [
    "environment monitoring platform",
    "waste management system",
    "carbon tracking application",
    "recycling management platform",
    "water conservation system",
    "pollution monitoring system",
    "sustainability tracking platform",
  ],

  Transportation: [
    "transportation management platform",
    "smart parking system",
    "vehicle tracking platform",
    "public transport application",
    "ride sharing platform",
    "traffic prediction system",
    "fleet management system",
  ],

  "Social Impact": [
    "community support platform",
    "volunteer management system",
    "social assistance application",
    "donation management platform",
    "community communication system",
    "local problem reporting platform",
  ],

  Productivity: [
    "task management platform",
    "team collaboration system",
    "personal productivity application",
    "project management platform",
    "time management application",
    "digital note-taking platform",
    "workflow automation system",
  ],

  Entertainment: [
    "digital entertainment platform",
    "content recommendation system",
    "event discovery application",
    "music discovery platform",
    "movie recommendation system",
    "creator community platform",
  ],

  Tourism: [
    "travel planning platform",
    "tourist recommendation application",
    "local tourism marketplace",
    "travel itinerary planner",
    "hotel discovery platform",
    "tourist assistance application",
  ],

  Energy: [
    "energy monitoring platform",
    "smart electricity management system",
    "solar energy monitoring platform",
    "energy consumption analytics system",
    "renewable energy management platform",
    "power usage prediction system",
  ],

  "Food Technology": [
    "food delivery platform",
    "restaurant management system",
    "food waste tracking platform",
    "nutrition recommendation application",
    "smart kitchen system",
    "restaurant discovery platform",
  ],
};

const problems = [
  "helps users solve everyday problems",
  "helps organizations improve operational efficiency",
  "helps users make better decisions",
  "reduces manual work through digital automation",
  "provides personalized recommendations",
  "improves access to useful information",
  "helps users monitor important activities",
  "provides real-time insights and analytics",
  "connects users with relevant services",
  "simplifies a complex workflow",
  "reduces time required for routine tasks",
  "helps identify potential problems early",
];

const technologies = [
  "React and Node.js",
  "React and Express",
  "Next.js and PostgreSQL",
  "Python and machine learning",
  "Python and FastAPI",
  "Java and Spring Boot",
  "Kotlin and Android",
  "Flutter and Firebase",
  "Node.js and MongoDB",
  "Python and TensorFlow",
  "JavaScript and PostgreSQL",
  "TypeScript and Node.js",
];

const features = [
  "real-time notifications",
  "personalized dashboards",
  "analytics and reporting",
  "user authentication",
  "recommendation features",
  "automated alerts",
  "search and filtering",
  "data visualization",
  "role-based access",
  "mobile support",
  "AI-assisted recommendations",
  "real-time monitoring",
];

const audiences = [
  "students",
  "small businesses",
  "farmers",
  "healthcare professionals",
  "teachers and learners",
  "local communities",
  "customers",
  "employees",
  "developers",
  "travelers",
  "city administrators",
  "individual users",
];

function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function createTitle(domain, index) {
  const prefixes = [
    "Smart",
    "AI",
    "Digital",
    "Intelligent",
    "NextGen",
    "Easy",
    "Connected",
    "Automated",
    "Modern",
    "Secure",
    "Personalized",
    "RealTime",
  ];

  const suffixes = [
    "Hub",
    "Assistant",
    "Platform",
    "System",
    "Manager",
    "Tracker",
    "Analyzer",
    "Connect",
    "Pro",
    "360",
    "Solution",
    "Portal",
  ];

  return `${randomItem(prefixes)} ${domain} ${randomItem(suffixes)} ${index}`;
}

function createDescription(category, domain, index) {
  const problem = randomItem(problems);
  const technology = randomItem(technologies);
  const feature1 = randomItem(features);
  const feature2 = randomItem(features);
  const audience = randomItem(audiences);

  return (
    `A ${domain.toLowerCase()} designed for ${audience}. ` +
    `The project ${problem}. ` +
    `It provides ${feature1} and ${feature2} to improve the overall user experience. ` +
    `The proposed solution can be developed using ${technology}. ` +
    `The system focuses on ${category.toLowerCase()} and provides a practical digital solution for real-world users. ` +
    `Project reference ${index}.`
  );
}

const TOTAL_PROJECTS = 12000;

const projects = [];

for (let i = 1; i <= TOTAL_PROJECTS; i++) {
  const category = randomItem(categories);
  const domain = randomItem(domains[category]);

  projects.push({
    id: i,
    title: createTitle(domain, i),
    description: createDescription(category, domain, i),
    category,
    technology: randomItem(technologies),
  });
}

fs.mkdirSync(outputDir, { recursive: true });

fs.writeFileSync(
  outputFile,
  JSON.stringify(projects, null, 2),
  "utf-8"
);

console.log("======================================");
console.log("IdeaCheck Dataset Generated");
console.log("======================================");
console.log(`Total projects: ${projects.length}`);
console.log(`Output: ${outputFile}`);
console.log("======================================");