import React, { useState } from "react";

import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useParams,
} from "react-router-dom";

import LandingPage from "./LandingPage";
import Login from "./Login";
import Register from "./Register";
import Initializing from "./Initializing";

import StudentPanel from "./StudentPanel";
import OrganizerPanel from "./OrganizerPanel";
import AdminPanel from "./AdminPanel";
import PublicDigitalCard from "./pages/PublicDigitalCard";



/* =========================================================
   ROLE HELPER
========================================================= */

function getStoredUser() {
  try {
    return JSON.parse(
      localStorage.getItem("user") || "{}"
    );
  } catch {
    return {};
  }
}


/* =========================================================
   PROTECTED ROLE ROUTE
========================================================= */

function RoleRoute({
  role,
  children,
}) {
  const token =
    localStorage.getItem("token");

  const user = getStoredUser();

  const actualRole = String(
    user.role ||
      localStorage.getItem("role") ||
      ""
  ).toUpperCase();


  /* ---------------------------------------------------------
     Not logged in
  --------------------------------------------------------- */

  if (!token) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }


  /* ---------------------------------------------------------
     Wrong role
  --------------------------------------------------------- */

  if (actualRole !== role) {

    if (actualRole === "STUDENT") {
      return (
        <Navigate
          to="/student"
          replace
        />
      );
    }

    if (actualRole === "ORGANIZER") {
      return (
        <Navigate
          to="/organizer"
          replace
        />
      );
    }

    if (actualRole === "ADMIN") {
      return (
        <Navigate
          to="/admin"
          replace
        />
      );
    }

    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }


  return children;
}


/* =========================================================
   ORGANIZER PAGE
========================================================= */

function OrganizerPage() {

  const navigate =
    useNavigate();

  const { section } =
    useParams();

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);


  const user =
    getStoredUser();


  const navigateOrganizer = (
    nextSection
  ) => {

    navigate(
      `/organizer/${nextSection}`
    );

    setSidebarOpen(false);
  };


  const handleLogout = () => {

    localStorage.removeItem(
      "token"
    );

    localStorage.removeItem(
      "user"
    );

    localStorage.removeItem(
      "role"
    );

    navigate(
      "/login",
      {
        replace: true,
      }
    );
  };


  return (
    <OrganizerPanel

      section={
        section ||
        "dashboard"
      }

      navigate={
        navigateOrganizer
      }

      sidebarOpen={
        sidebarOpen
      }

      setSidebarOpen={
        setSidebarOpen
      }

      user={
        user
      }

      onLogout={
        handleLogout
      }

    />
  );
}


/* =========================================================
   ADMIN PAGE
========================================================= */

function AdminPage() {

  const navigate =
    useNavigate();

  const { section } =
    useParams();

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);


  const user =
    getStoredUser();


  const navigateAdmin = (
    nextSection
  ) => {

    navigate(
      `/admin/${nextSection}`
    );

    setSidebarOpen(false);
  };


  const handleLogout = () => {

    localStorage.removeItem(
      "token"
    );

    localStorage.removeItem(
      "user"
    );

    localStorage.removeItem(
      "role"
    );

    navigate(
      "/login",
      {
        replace: true,
      }
    );
  };


  return (
    <AdminPanel

      section={
        section ||
        "dashboard"
      }

      navigate={
        navigateAdmin
      }

      sidebarOpen={
        sidebarOpen
      }

      setSidebarOpen={
        setSidebarOpen
      }

      user={
        user
      }

      onLogout={
        handleLogout
      }

    />
  );
}


/* =========================================================
   APP
========================================================= */

function App() {

  return (

    <BrowserRouter>

      <Routes>


        {/* ===================================================
            LANDING
        =================================================== */}

        <Route
          path="/"
          element={
            <LandingPage />
          }
        />


        {/* ===================================================
            LOGIN
        =================================================== */}

        <Route
          path="/login"
          element={
            <Login />
          }
        />


        {/* ===================================================
            REGISTER
        =================================================== */}

        <Route
          path="/register"
          element={
            <Register />
          }
        />


        {/* ===================================================
            INITIALIZATION
        =================================================== */}

        <Route
          path="/initializing"
          element={
            <Initializing />
          }
        />


        {/* ===================================================
            PUBLIC QR DIGITAL CARD
        =================================================== */}

        <Route
          path="/u/:campusId"
          element={<PublicDigitalCard />}
        />


        {/* ===================================================
            STUDENT
        =================================================== */}

        <Route
          path="/student"
          element={
            <RoleRoute
              role="STUDENT"
            >
              <StudentPanel />
            </RoleRoute>
          }
        />


        {/* ===================================================
            ORGANIZER
        =================================================== */}

        <Route
          path="/organizer"
          element={
            <RoleRoute
              role="ORGANIZER"
            >
              <OrganizerPage />
            </RoleRoute>
          }
        />


        <Route
          path="/organizer/:section"
          element={
            <RoleRoute
              role="ORGANIZER"
            >
              <OrganizerPage />
            </RoleRoute>
          }
        />


        {/* ===================================================
            ADMIN
        =================================================== */}

        <Route
          path="/admin"
          element={
            <RoleRoute
              role="ADMIN"
            >
              <AdminPage />
            </RoleRoute>
          }
        />


        <Route
          path="/admin/:section"
          element={
            <RoleRoute
              role="ADMIN"
            >
              <AdminPage />
            </RoleRoute>
          }
        />


        {/* ===================================================
            FALLBACK
        =================================================== */}

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />

      </Routes>

    </BrowserRouter>
  );
}

export default App;