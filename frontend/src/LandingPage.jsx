
import React, { useEffect, useState } from "react";
import "./LandingPage.css";

const hackathons = [
  {
    number: "01",
    category: "ARTIFICIAL INTELLIGENCE",
    title: "AI INNOVATION",
    description: "Build intelligent solutions for problems that matter.",
    status: "LIVE",
  },
  {
    number: "02",
    category: "WEB DEVELOPMENT",
    title: "FUTURE WEB",
    description:
      "Design and ship the next generation of digital experiences.",
    status: "OPEN",
  },
  {
    number: "03",
    category: "SMART TECHNOLOGY",
    title: "CAMPUS TECH",
    description: "Create technology that makes student life better.",
    status: "UPCOMING",
  },
];

const steps = [
  {
    number: "01",
    title: "DISCOVER",
    text: "Find a challenge that makes you want to build.",
  },
  {
    number: "02",
    title: "TEAM UP",
    text: "Find people who share your ambition.",
  },
  {
    number: "03",
    title: "BUILD",
    text: "Turn your idea into something people can use.",
  },
  {
    number: "04",
    title: "SHIP",
    text: "Submit your work and take it to the arena.",
  },
];

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [experienceActive, setExperienceActive] = useState(false);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouse = (event) => {
      setMouse({
        x: event.clientX,
        y: event.clientY,
      });
    };

    window.addEventListener("mousemove", handleMouse);

    return () => {
      window.removeEventListener("mousemove", handleMouse);
    };
  }, []);

  const scrollTo = (id) => {
    const element = document.getElementById(id);

    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }

    setMenuOpen(false);
  };

  const goTo = (path) => {
    window.location.href = path;
  };

  return (
    <div className="campus-landing">
      {/* CURSOR */}
      <div
        className="landing-cursor"
        style={{
          left: `${mouse.x}px`,
          top: `${mouse.y}px`,
        }}
      />

      {/* NAVBAR */}
      <header className="landing-nav">
        <button
          type="button"
          className="landing-logo"
          onClick={() => goTo("/")}
          aria-label="CampusCode home"
        >
          <span className="landing-logo-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>
            <strong>CAMPUSCODE</strong>
            <small>HACKATHON ARENA</small>
          </span>
        </button>

        <nav className={`landing-links ${menuOpen ? "open" : ""}`}>
          <button onClick={() => scrollTo("about")}>ABOUT</button>

          <button onClick={() => scrollTo("how")}>
            HOW IT WORKS
          </button>

          <button onClick={() => scrollTo("hackathons")}>
            HACKATHONS
          </button>

          <button onClick={() => scrollTo("community")}>
            COMMUNITY
          </button>
        </nav>

        <div className="landing-nav-actions">
          <button
            className="landing-login"
            onClick={() => goTo("/login")}
          >
            LOGIN
          </button>

          <button
            className="landing-join"
            onClick={() => goTo("/register")}
          >
            JOIN CAMPUSCODE
            <span>↗</span>
          </button>
        </div>

        <button
          className="landing-menu"
          onClick={() => setMenuOpen((value) => !value)}
          aria-label="Toggle menu"
        >
          {menuOpen ? "×" : "☰"}
        </button>
      </header>

      {/* HERO */}
      <section className="landing-hero">
        <div className="landing-hero-grid" />

        <div className="hero-glow glow-one" />
        <div className="hero-glow glow-two" />
        <div className="hero-glow glow-three" />

        <div className="hero-network">
          <svg
            viewBox="0 0 1400 800"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M0 600 C180 450 250 620 420 430 S680 80 900 270 S1150 500 1400 180" />
            <path d="M80 130 C280 300 380 80 570 270 S800 620 1080 500 S1250 400 1400 620" />
            <path d="M250 800 C400 600 570 650 720 460 S970 180 1160 80" />

            <circle cx="420" cy="430" r="5" />
            <circle cx="900" cy="270" r="5" />
            <circle cx="1080" cy="500" r="5" />
            <circle cx="570" cy="270" r="5" />
            <circle cx="1160" cy="80" r="5" />
          </svg>
        </div>

        <div className="hero-top-line">
          <span>
            <i />
            THE DIGITAL HOME FOR STUDENT INNOVATION
          </span>

          <span>CHENNAI · INDIA</span>
        </div>

        <div className="hero-content">
          <div className="hero-label">CAMPUSCODE / 001</div>

          <h1>
            BUILD
            <br />
            <span>COMPETE</span>
            <br />
            SHIP.
          </h1>

          <div className="hero-description">
            <p>
              A digital arena for students
              <br />
              who don&apos;t just have ideas.
              <br />
              They build them.
            </p>

            <button
              className="hero-explore"
              onClick={() => scrollTo("hackathons")}
            >
              <span>EXPLORE HACKATHONS</span>
              <b>↗</b>
            </button>
          </div>
        </div>

        <div className="hero-bottom">
          <span>SCROLL TO EXPLORE</span>

          <div className="hero-scroll-line">
            <i />
          </div>

          <span>01 / 05</span>
        </div>
      </section>

      {/* MARQUEE */}
      <section className="landing-marquee">
        <div className="marquee-track">
          <span>IDEAS</span>
          <b>✦</b>
          <span>PEOPLE</span>
          <b>✦</b>
          <span>PRODUCTS</span>
          <b>✦</b>
          <span>INNOVATION</span>
          <b>✦</b>
          <span>COMMUNITY</span>
          <b>✦</b>
          <span>IDEAS</span>
          <b>✦</b>
          <span>PEOPLE</span>
          <b>✦</b>
          <span>PRODUCTS</span>
          <b>✦</b>
          <span>INNOVATION</span>
          <b>✦</b>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="landing-about">
        <div className="section-number">01</div>

        <div className="about-content">
          <div className="small-label">
            <i />
            WHAT IS CAMPUSCODE?
          </div>

          <h2>
            WHERE
            <br />
            STUDENTS
            <br />
            <em>BUILD.</em>
          </h2>

          <p>
            CampusCode brings students, teams, organizers and
            hackathons into one connected ecosystem.
          </p>
        </div>

        <div className="about-visual">
          <div className="about-ring ring-a" />
          <div className="about-ring ring-b" />
          <div className="about-ring ring-c" />

          <div className="about-core">CC</div>

          <span className="about-node node-1">01</span>
          <span className="about-node node-2">02</span>
          <span className="about-node node-3">03</span>
        </div>
      </section>

      {/* EXPERIENCE */}
      <section
        className={`landing-video ${
          experienceActive ? "experience-active" : ""
        }`}
      >
        <div className="video-grid" />

        <div className="video-rings">
          <div />
          <div />
          <div />
        </div>

        <div className="video-center">
          <small>THE CAMPUSCODE EXPERIENCE</small>

          <strong>
            BUILD
            <br />
            TOGETHER.
          </strong>

          <button
            className={`experience-play ${
              experienceActive ? "active" : ""
            }`}
            onClick={() =>
              setExperienceActive((value) => !value)
            }
            aria-label={
              experienceActive
                ? "Pause CampusCode experience"
                : "Play CampusCode experience"
            }
          >
            {experienceActive ? "Ⅱ" : "▶"}
          </button>
        </div>

        <div className="video-top">
          <span>02 — EXPERIENCE</span>
          <span>00:01</span>
        </div>

        <div className="video-bottom">
          <span>WATCH THE STORY</span>
          <span>PLAY FILM ↗</span>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="landing-how">
        <div className="section-heading">
          <div>
            <span>03</span>
            <h2>HOW IT WORKS</h2>
          </div>

          <p>
            FROM IDEA
            <br />
            TO IMPACT.
          </p>
        </div>

        <div className="steps-grid">
          {steps.map((step) => (
            <div className="step-card" key={step.number}>
              <div className="step-number">{step.number}</div>

              <div className="step-line" />

              <h3>{step.title}</h3>

              <p>{step.text}</p>

              <span className="step-arrow">↗</span>
            </div>
          ))}
        </div>
      </section>

      {/* HACKATHONS */}
      <section id="hackathons" className="landing-hackathons">
        <div className="section-heading">
          <div>
            <span>04</span>
            <h2>ENTER THE ARENA</h2>
          </div>

          <button type="button">VIEW ALL ↗</button>
        </div>

        <div className="hackathon-list">
          {hackathons.map((hackathon) => (
            <article
              className="hackathon-row"
              key={hackathon.number}
            >
              <div className="hack-number">
                {hackathon.number}
              </div>

              <div className="hack-title">
                <small>{hackathon.category}</small>
                <h3>{hackathon.title}</h3>
              </div>

              <p>{hackathon.description}</p>

              <div className="hack-status">
                <i
                  className={
                    hackathon.status === "LIVE"
                      ? "active"
                      : ""
                  }
                />

                {hackathon.status}
              </div>

              <span className="hack-arrow">↗</span>
            </article>
          ))}
        </div>
      </section>

      {/* STATEMENT */}
      <section className="landing-statement">
        <div className="statement-watermark">CAMPUSCODE</div>

        <div className="statement-content">
          <span>05 — THE MISSION</span>

          <h2>
            GREAT
            <br />
            IDEAS
            <br />
            <em>NEED BUILDERS.</em>
          </h2>

          <p>
            Your university is full of people with ideas.
            CampusCode gives those ideas somewhere to go.
          </p>
        </div>
      </section>

      {/* COMMUNITY */}
      <section id="community" className="landing-community">
        <div className="community-left">
          <span>THE NETWORK</span>

          <h2>
            FIND
            <br />
            YOUR
            <br />
            <em>PEOPLE.</em>
          </h2>
        </div>

        <div className="community-right">
          <div className="community-orbit">
            <span />
            <span />
            <span />
            <span />
            <span />

            <strong>CC</strong>
          </div>

          <p>
            Build with developers.
            <br />
            Think with designers.
            <br />
            Compete with builders.
          </p>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="landing-cta">
        <div className="cta-grid" />

        <div className="cta-content">
          <small>READY?</small>

          <h2>
            YOUR NEXT
            <br />
            <span>PROJECT</span>
            <br />
            STARTS HERE.
          </h2>

          <button
            type="button"
            onClick={() => goTo("/register")}
          >
            JOIN CAMPUSCODE
            <span>↗</span>
          </button>
        </div>

        <div className="cta-orb" />
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        <div className="footer-main">
          <div className="footer-brand">
            <div className="footer-logo">
              <span className="footer-mark" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <span>
                <strong>CAMPUSCODE</strong>
                <small>HACKATHON ARENA</small>
              </span>
            </div>

            <p>
              The student hackathon arena.
              <br />
              You build the idea,
              <br />
              we run the competition.
            </p>
          </div>

          <div className="footer-column">
            <h4>PRODUCT</h4>

            <a href="#about">About</a>
            <a href="#hackathons">Hackathons</a>
            <a href="#how">How it works</a>
            <a href="#community">Community</a>
          </div>

          <div className="footer-column">
            <h4>BUILDERS</h4>

            <a href="#student">Students</a>
            <a href="#teams">Teams</a>
            <a href="#organizers">Organizers</a>
            <a href="#developers">Developers</a>
          </div>

          <div className="footer-column">
            <h4>GUIDES</h4>

            <a href="#rules">Hackathon Rules</a>
            <a href="#faq">FAQ</a>
            <a href="#support">Support</a>
            <a href="#contact">Contact</a>
          </div>
        </div>

        <div className="footer-status">
          <div>
            <i />
            ALL SYSTEMS OPERATIONAL
          </div>

          <a href="#terms">TERMS</a>
          <a href="#privacy">PRIVACY</a>
          <a href="#contact">CONTACT</a>
        </div>

        <div className="footer-watermark">CampusCode</div>

        <div className="footer-bottom">
          <span>© 2026 CAMPUSCODE</span>
          <span>LEARN · BUILD · COMPETE · SHIP</span>
          <span>CHENNAI · INDIA</span>
        </div>
      </footer>
    </div>
  );
}

