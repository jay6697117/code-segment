const fs = require('fs')
const path = require('path')
const OSS = require('ali-oss')
const colors = require('ansi-colors')
const log = require('fancy-log')

class AliOSS {
  constructor(options) {
    const params = {}
    const result = ['accessKeyId', 'accessKeySecret', 'bucket', 'region'].some(key => {
      if (options[key]) {
        params[key] = options[key]
        return false
      }
      return true
    })

    if (result) {
      return log(colors.red(`请填写正确的accessKeyId、accessKeySecret和bucket`))
    }

    this.client = new OSS(params)
    this.config = {
      prefix: '',
      exclude: null,
      format: null,
      deleteAll: false,
      output: './dist'
    }
    const otherArr = Object.keys(this.config)
    while (otherArr.length) {
      const key = otherArr.pop()
      if (key in options) {
        this.config[key] = options[key]
      }
    }
    this.init()
  }

  init() {
    if (this.config.format && !isNaN(Number(this.config.format))) {
      this.delCacheAssets()
    } else if (this.config.deleteAll) {
      this.delAllAssets()
    } else {
      this.uploadAssets()
    }
  }

  async delFilterAssets(prefix) {
    try {
      const list = []
      list.push(prefix)
      let result = await this.client.list({
        prefix,
        'max-keys': 1000
      })
      if (result.objects) {
        result.objects.forEach(file => {
          list.push(file.name)
        })
      }
      if (Array.isArray(list)) {
        result = await this.client.deleteMulti(list, {
          quiet: true
        })
      }
    } catch (error) {
      log(colors.red(`删除缓存文件失败!`))
    }
  }

  async delCacheAssets() {
    const prefix = this.config.prefix
    const list = []
    try {
      const dirList = await this.client.list({
        prefix: `${prefix}/`,
        delimiter: '/'
      })

      if (dirList.prefixes) {
        dirList.prefixes.forEach(subDir => {
          list.push(+subDir.slice(prefix.length + 1, -1))
        })
      }

      if (list.length > 1) {
        const max = Math.max.apply(null, list)
        list.splice(list.indexOf(max), 1)
        await this.asyncForEach(list, async (item, index) => {
          await this.delFilterAssets(`${prefix}/${item}`)
        })
      }

      this.uploadAssets()
    } catch (error) {
      this.uploadAssets()
    }
  }

  async asyncForEach(arr, cb) {
    for (let i = 0; i < arr.length; i++) {
      await cb(arr[i], i)
    }
  }

  async delAllAssets() {
    try {
      const { prefix } = this.config
      let result = await this.client.list({
        prefix,
        'max-keys': 1000
      })
      if (result.objects) {
        result = result.objects.map(file => file.name)
      }
      if (Array.isArray(result)) {
        result = await this.client.deleteMulti(result, { quiet: true })
      }
      this.uploadAssets()
    } catch (error) {
      this.uploadAssets()
    }
  }

  async uploadAssets() {
    await this.uploadLocale(this.config.output)
  }

  filterFile(name) {
    const { exclude } = this.config
    return (
      !exclude ||
      ((Array.isArray(exclude) && !exclude.some(item => item.test(name))) ||
        (!Array.isArray(exclude) && !exclude.test(name)))
    )
  }

  getFileName(name) {
    const { config } = this
    const prefix = config.format
      ? path.join(config.prefix, config.format.toString())
      : config.prefix
    return path.join(prefix, name).replace(/\\/g, '/')
  }

  async update(name, content) {
    const fileName = this.getFileName(name)
    try {
      const result = await this.client.put(fileName, content)
      if (+result.res.statusCode === 200) {
        log(colors.green(`${fileName}上传成功!`))
      } else {
        log(colors.red(`${fileName}上传失败!`))
      }
    } catch (error) {
      log(colors.red(`${fileName}上传失败!`))
    }
  }

  async uploadLocale(dir) {
    const result = fs.readdirSync(dir)
    await this.asyncForEach(result, async file => {
      const filePath = path.join(dir, file)
      if (this.filterFile(filePath)) {
        if (fs.lstatSync(filePath).isDirectory()) {
          await this.uploadLocale(filePath)
        } else {
          const fileName = filePath.slice(this.config.output.length)
          await this.update(fileName, filePath)
        }
      }
    })
  }
}

const o = new AliOSS({
  accessKeyId: '3o04sbsb4c6bplo75cbx1bb8',
  accessKeySecret: 'ze8ahNn54ARO0xl3hYgCUfPdg2s=',
  region: 'oss-cn-hangzhou',
  bucket: 'img-wechat',
  prefix: 'staven1111',
  exclude: /.*\.html$/,
  output: path.resolve(__dirname, './.nuxt/dist/client/')
})
