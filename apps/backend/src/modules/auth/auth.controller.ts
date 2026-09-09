import { Request, Response, Router } from 'express';
import { authService } from './auth.service';

export const authRouter = Router();

authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, fullName, role } = req.body;
    if (!email || !password || !fullName) {
      res.status(400).json({ success: false, message: 'Vui lòng cung cấp đầy đủ email, password và fullName' });
      return;
    }

    const result = await authService.register(email, password, fullName, role);
    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Lỗi đăng ký' });
  }
});

authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Vui lòng cung cấp email và password' });
      return;
    }

    const result = await authService.login(email, password);
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    res.status(401).json({ success: false, message: error.message || 'Lỗi đăng nhập' });
  }
});
