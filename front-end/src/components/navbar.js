import "./navbar.css";
import Logo from "../extras/Comic City.png";
import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { useGlobalContext } from "../Context";
import NotificationBell from "./NotificationBell/NotificationBell";

const BASE_URL = `${process.env.REACT_APP_URL}/api/comics`;

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const Navbar = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, logout, loginWithRedirect } = useAuth0();
  const { setSearchResults } = useGlobalContext();

  const [isSearchOpen,    setIsSearchOpen]    = useState(false);
  const [isMobileOpen,    setIsMobileOpen]    = useState(false);
  const [searchText,      setSearchText]      = useState("");
  const [suggestions,     setSuggestions]     = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex,   setSelectedIndex]   = useState(-1);

  const searchInputRef  = useRef(null);
  const navRef          = useRef(null);
  const skipNextClear   = useRef(false);
  const debouncedSearch = useDebounce(searchText, 280);

  // Close UI state on route change; but skip clearing results when
  // we just triggered the navigate ourselves from doFullSearch.
  useEffect(() => {
    setIsMobileOpen(false);
    if (skipNextClear.current) {
      skipNextClear.current = false;
      setIsSearchOpen(false);
      setSuggestions([]);
      setShowSuggestions(false);
      setSearchText("");
      return;
    }
    setIsSearchOpen(false);
    setSuggestions([]);
    setShowSuggestions(false);
    setSearchText("");
    setSearchResults([]);
  }, [location.pathname, setSearchResults]);

  // Live autocomplete
  useEffect(() => {
    if (!debouncedSearch.trim() || debouncedSearch.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    axios
      .get(`${BASE_URL}/search/${encodeURIComponent(debouncedSearch)}`)
      .then((res) => {
        const data = res.data.data || [];
        setSuggestions(data.slice(0, 8));
        setShowSuggestions(data.length > 0);
        setSelectedIndex(-1);
      })
      .catch(() => {});
  }, [debouncedSearch]);

  // Click outside closes autocomplete
  useEffect(() => {
    const handler = (e) => {
      if (navRef.current && !navRef.current.contains(e.target))
        setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const openSearch = () => {
    setIsSearchOpen(true);
    setIsMobileOpen(false);
    setTimeout(() => searchInputRef.current?.focus(), 60);
  };

  const closeSearch = () => {
    setIsSearchOpen(false);
    setSearchText("");
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // Full search: set results then navigate, preserving them across the route change
  const doFullSearch = async () => {
    if (!searchText.trim()) return;
    try {
      const res     = await axios.get(`${BASE_URL}/search/${encodeURIComponent(searchText)}`);
      const results = res.data.data || [];
      setSearchResults(results);
      closeSearch();
      if (location.pathname !== "/") {
        skipNextClear.current = true;
        navigate("/");
      }
    } catch {}
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions) {
      if (e.key === "Enter"  && searchText.trim()) doFullSearch();
      if (e.key === "Escape") closeSearch();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      if (selectedIndex >= 0) pickSuggestion(suggestions[selectedIndex]);
      else doFullSearch();
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      closeSearch();
    }
  };

  const pickSuggestion = useCallback((comic) => {
    setShowSuggestions(false);
    closeSearch();
    navigate(`/comics/${comic._id}`);
  }, [navigate]);

  const handleUploadClick = () => {
    setIsMobileOpen(false);
    if (user) navigate("/upload");
    else loginWithRedirect({ appState: { returnTo: "/upload" } });
  };

  const handleLogout = () => {
    sessionStorage.setItem("cc_logout_return", location.pathname + location.search);
    logout({ logoutParams: { returnTo: window.location.origin } });
  };

  const isActive = (path) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  return (
    <div className="navBody" ref={navRef}>
      <header className={`navHeader${isSearchOpen ? " searchMode" : ""}`}>

        {/* Logo — hidden on mobile when search is open */}
        <Link to="/" className="navLogo">
          <img src={Logo} alt="Comic City" />
        </Link>

        {/* Center: nav links OR search bar */}
        <div className="navCenter">
          {isSearchOpen ? (
            <div className="searchExpanded">
              {/* Back arrow — mobile only, closes search */}
              <button className="searchBackBtn" onClick={closeSearch} aria-label="Back">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 5l-7 7 7 7"/>
                </svg>
              </button>

              <div className="searchInputWrap">
                <svg className="searchFieldIcon" width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  ref={searchInputRef}
                  className="searchExpandedInput"
                  type="text"
                  placeholder="Search comics, authors, genres…"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoComplete="off"
                />
                {searchText && (
                  <button className="searchClearInline"
                    onClick={() => { setSearchText(""); searchInputRef.current?.focus(); }}
                    aria-label="Clear">✕</button>
                )}
              </div>

              {/* Close button — desktop only */}
              <button className="searchCloseBtn" onClick={closeSearch} aria-label="Close">✕</button>

              {/* Autocomplete dropdown */}
              {showSuggestions && (
                <div className="suggestionsDropdown">
                  {suggestions.map((comic, idx) => (
                    <div
                      key={comic._id}
                      className={`suggestionItem${idx === selectedIndex ? " active" : ""}`}
                      onMouseDown={() => pickSuggestion(comic)}
                    >
                      <img src={comic.coverImage?.url} alt={comic.comicName}
                        className="suggestionThumb" loading="lazy" />
                      <div className="suggestionInfo">
                        <span className="suggestionName">{comic.comicName}</span>
                        <span className="suggestionAuthor">{comic.authorName}</span>
                      </div>
                    </div>
                  ))}
                  <div className="suggestionFooter" onMouseDown={doFullSearch}>
                    See all results for "<strong>{searchText}</strong>"
                  </div>
                </div>
              )}
            </div>
          ) : (
            <nav className="navLinks">
              <Link to="/"        className={`navLink${isActive("/")        ? " active" : ""}`}>Home</Link>
              <button             className="navLink uploadBtn" onClick={handleUploadClick}>Upload</button>
              <Link to="/comics"  className={`navLink${isActive("/comics")  ? " active" : ""}`}>Comics</Link>
              <Link to="/popular" className={`navLink${isActive("/popular") ? " active" : ""}`}>Popular</Link>
              <Link to="/aboutus" className={`navLink${isActive("/aboutus") ? " active" : ""}`}>About Us</Link>
            </nav>
          )}
        </div>

        {/* Right section */}
        <div className="navRight">
          {/* Search icon — hidden on mobile when search is already open */}
          {!isSearchOpen && (
            <button className="navIconBtn" onClick={openSearch} aria-label="Search">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </button>
          )}

          {/* Notification bell — both breakpoints, hides on mobile when search open via CSS */}
          {user && <NotificationBell />}

          {/* Desktop-only: user avatar dropdown or sign-in button */}
          {user ? (
            <div className="userMenu navDesktopOnly">
              <img src={user.picture} alt={user.name} className="userAvatar" />
              <div className="userDropdown">
                <span className="userName">{user.given_name || user.name}</span>
                <Link to="/profile" className="profileLink">My Profile</Link>
                <button className="logoutBtn" onClick={handleLogout}>Logout</button>
              </div>
            </div>
          ) : (
            <button
              className="loginBtn btn btn-primary navDesktopOnly"
              onClick={() => loginWithRedirect({ appState: { returnTo: location.pathname } })}
            >
              Sign In
            </button>
          )}

          {/* Hamburger — mobile only */}
          <button
            className={`hamburger${isMobileOpen ? " open" : ""}`}
            onClick={() => setIsMobileOpen((o) => !o)}
            aria-label="Toggle menu"
            aria-expanded={isMobileOpen}
          >
            <span /><span /><span />
          </button>
        </div>
      </header>

      {/* Mobile backdrop */}
      <div
        className={`mobileDrawer${isMobileOpen ? " open" : ""}`}
        onClick={() => setIsMobileOpen(false)}
      />

      {/* Mobile slide-in drawer */}
      <nav className={`mobileNav${isMobileOpen ? " open" : ""}`}>

        {/* User info strip at top */}
        {user && (
          <div className="mobileUserStrip">
            <img src={user.picture} alt={user.name} className="mobileUserAvatar" />
            <div>
              <p className="mobileUserName">{user.given_name || user.name}</p>
              <p className="mobileUserEmail">{user.email}</p>
            </div>
          </div>
        )}

        {/* Nav links */}
        <div className="mobileNavLinks">
          <Link to="/"        className={`mobileNavLink${isActive("/")        ? " active" : ""}`} onClick={() => setIsMobileOpen(false)}>Home</Link>
          <button             className="mobileNavLink uploadBtn"                                  onClick={handleUploadClick}>Upload</button>
          <Link to="/comics"  className={`mobileNavLink${isActive("/comics")  ? " active" : ""}`} onClick={() => setIsMobileOpen(false)}>Comics</Link>
          <Link to="/popular" className={`mobileNavLink${isActive("/popular") ? " active" : ""}`} onClick={() => setIsMobileOpen(false)}>Popular</Link>
          <Link to="/aboutus" className={`mobileNavLink${isActive("/aboutus") ? " active" : ""}`} onClick={() => setIsMobileOpen(false)}>About Us</Link>
          {user && (
            <Link to="/profile" className={`mobileNavLink${isActive("/profile") ? " active" : ""}`} onClick={() => setIsMobileOpen(false)}>
              👤 My Profile
            </Link>
          )}
        </div>

        {/* Auth at bottom of drawer */}
        <div className="mobileAuthSection">
          {user ? (
            <button className="mobileLogoutBtn" onClick={handleLogout}>Sign Out</button>
          ) : (
            <button
              className="mobileSignInBtn"
              onClick={() => { setIsMobileOpen(false); loginWithRedirect({ appState: { returnTo: location.pathname } }); }}
            >
              Sign In
            </button>
          )}
        </div>
      </nav>
    </div>
  );
};

export default Navbar;
