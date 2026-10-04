import { Router, type IRouter } from "express";
import healthRouter from "./health";
import goalsRouter from "./goals";
import itemsRouter from "./items";
import dashboardRouter from "./dashboard";
import backupRouter from "./backup";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(requireAuth);
router.use(goalsRouter);
router.use(itemsRouter);
router.use(dashboardRouter);
router.use(backupRouter);

export default router;
