import { NavLink, Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <>
      <nav className="topnav">
        <div className="topnav-inner">
          <NavLink to="/" end className="brand">SVD Compression</NavLink>
          <div className="links">
            <NavLink to="/" end>Compressor</NavLink>
            <NavLink to="/analise">Análise</NavLink>
            <NavLink to="/teoria">Teoria</NavLink>
          </div>
        </div>
      </nav>
      <main className="main">
        <Outlet />
      </main>
      <footer className="footer">
        Feito por <strong>João Victor Borges Nascimento</strong>
      </footer>
    </>
  );
}
