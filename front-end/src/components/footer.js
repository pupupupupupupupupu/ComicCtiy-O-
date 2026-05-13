import "./footer.css";

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footerInner">
        <p className="footerBrand">Comic City</p>
        <p className="footerTagline">Your universe of stories.</p>
        <p className="footerCopy">&copy; {new Date().getFullYear()} Comic City. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
