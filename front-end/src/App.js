import React, { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { AppProvider } from "./Context";
import { SocketProvider } from "./SocketContext";
import Navbar      from "./components/navbar";
import Footer      from "./components/footer";
import ComicLoader from "./components/ComicLoader";
import "./App.css";

const HomePage    = lazy(() => import("./pages/home/home"));
const Comics      = lazy(() => import("./pages/comics/comics"));
const Upload      = lazy(() => import("./components/upload"));
const AboutUs     = lazy(() => import("./pages/aboutUs/aboutUs"));
const Details     = lazy(() => import("./pages/selectedComic/selectedComic"));
const ReadComic   = lazy(() => import("./pages/readComic/readComic"));
const Popular     = lazy(() => import("./pages/popular/Popular"));
const Profile     = lazy(() => import("./pages/profile/Profile"));
const NotFound    = lazy(() => import("./pages/NotFound"));
const UserProfile = lazy(() => import("./pages/userProfile/UserProfile"));
const ArtistPage  = lazy(() => import("./pages/artist/ArtistPage"));
const CollabChat  = lazy(() => import("./pages/collab/CollabChat"));

// Auth0Provider that has access to useNavigate (must be inside BrowserRouter)
const Auth0ProviderWithNavigate = ({ children }) => {
  const navigate = useNavigate();

  const onRedirectCallback = (appState) => {
    // After login, send user back to the page they were on
    navigate(appState?.returnTo || "/", { replace: true });
  };

  return (
    <Auth0Provider
      domain={process.env.REACT_APP_AUTH0_DOMAIN}
      clientId={process.env.REACT_APP_AUTH0_CLIENT_ID}
      authorizationParams={{ redirect_uri: window.location.origin }}
      onRedirectCallback={onRedirectCallback}
    >
      {children}
    </Auth0Provider>
  );
};

// Handles returning to the correct page after logout
const LogoutReturnHandler = () => {
  const { isLoading, isAuthenticated } = useAuth0();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading || isAuthenticated) return;
    const returnPath = sessionStorage.getItem("cc_logout_return");
    if (returnPath) {
      sessionStorage.removeItem("cc_logout_return");
      navigate(returnPath, { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  return null;
};

// Shows a loader while Auth0 initialises
const AuthGate = ({ children }) => {
  const { isLoading } = useAuth0();
  if (isLoading) return <ComicLoader message="Opening the vault…" />;
  return children;
};

function App() {
  return (
    <BrowserRouter>
      <Auth0ProviderWithNavigate>
        <AppProvider>
          <SocketProvider>
          <AuthGate>
            <LogoutReturnHandler />
            <div className="appShell">
              <Navbar />
              <main className="mainContent">
                <Suspense fallback={<ComicLoader message="Turning the page…" />}>
                  <Routes>
                    <Route path="/"                           element={<HomePage />} />
                    <Route path="/comics"                     element={<Comics />} />
                    <Route path="/comics/:id"                 element={<Details />} />
                    <Route path="/comics/:id/read"            element={<ReadComic />} />
                    <Route path="/comics/:id/read/:chapterId" element={<ReadComic />} />
                    <Route path="/upload"                     element={<Upload />} />
                    <Route path="/aboutus"                    element={<AboutUs />} />
                    <Route path="/popular"                    element={<Popular />} />
                    <Route path="/profile"                    element={<Profile />} />
                    <Route path="/user/:userId"               element={<UserProfile />} />
                    <Route path="/artist/:name"               element={<ArtistPage />} />
                    <Route path="/collab/:chatId"             element={<CollabChat />} />
                    <Route path="*"                           element={<NotFound />} />
                  </Routes>
                </Suspense>
              </main>
              <Footer />
            </div>
          </AuthGate>
          </SocketProvider>
        </AppProvider>
      </Auth0ProviderWithNavigate>
    </BrowserRouter>
  );
}

export default App;
