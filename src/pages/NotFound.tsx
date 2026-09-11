import { Link } from 'react-router-dom'
import { Btn, Card } from '@/ui'

export function NotFound({ what }: { what?: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-20">
      <Card className="text-center">
        <p className="font-mono text-4xl">¯\_(ツ)_/¯</p>
        <h1 className="mt-4 text-xl font-bold text-slate-800 dark:text-slate-100">
          没找到 {what ?? '这个页面'}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          可能是链接打错了，或者这个知识点还没上线。
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link to="/map">
            <Btn variant="primary">去知识地图</Btn>
          </Link>
          <Link to="/">
            <Btn variant="outline">回首页</Btn>
          </Link>
        </div>
      </Card>
    </div>
  )
}
