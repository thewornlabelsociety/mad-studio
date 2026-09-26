import { Router, type IRouter } from "express";
import healthRouter from "./health";
import actionsRouter from "./actions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(actionsRouter);

export default router;
