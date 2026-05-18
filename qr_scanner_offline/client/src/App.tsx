import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Redirect, Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Scanner from "./pages/Scanner";
import TicketValidator from "./pages/TicketValidator";
import AgentLogin from "./pages/AgentLogin";
import TeamScanner from "./pages/TeamScanner";

function HomeOrRedirect() {
  const params = new URLSearchParams(window.location.search);
  if (params.has("token")) {
    return <Redirect to={`/validator${window.location.search}`} />;
  }
  return <Home />;
}

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={HomeOrRedirect} />
      <Route path={"/scanner"} component={Scanner} />
      <Route path={"/validator"} component={TicketValidator} />
      <Route path={"/login"} component={AgentLogin} />
      <Route path={"/team"} component={TeamScanner} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
