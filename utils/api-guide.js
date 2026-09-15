/**
 * Python 数据分析 API 知识库
 *
 * 用于给每道填空生成「功能解析」：说明这个函数做什么、为什么这么做、原理是什么。
 * 不是复述题目要求，而是讲清 API 的能力。
 *
 * 每条: { what: 在这行里干什么, principle: 这个 API 的原理 }
 */

const API_GUIDE = {
  // ── 读取数据 ──
  'pd.read_csv': {
    what: '把 CSV 文件读进内存，得到一个 DataFrame 表格对象',
    principle: '`pd.read_csv()` 逐行解析 CSV 文本，首行默认作为列名，并自动推断每列的数据类型。路径是相对当前工作目录的，所以文件名要写全（含扩展名）。'
  },
  'pd.read_excel': {
    what: '把 Excel 文件读进内存，得到一个 DataFrame 表格对象',
    principle: '`pd.read_excel()` 解析 xlsx 二进制格式，默认读第一个工作表，可用 `sheet_name` 指定。需要 openpyxl 引擎支持。'
  },

  // ── 查看与探查 ──
  'head': {
    what: '查看数据的前几行，快速确认数据读对了没有',
    principle: '`head(n)` 返回前 n 行（默认 5 行）的副本，不会修改原数据。用来肉眼核对列名、分隔符、编码是否正确。'
  },
  'tail': {
    what: '查看数据的末尾几行',
    principle: '`tail(n)` 返回最后 n 行，常用来检查数据是否被截断、末尾有没有汇总行。'
  },
  'info': {
    what: '查看表结构：每列的名称、非空数量、数据类型、内存占用',
    principle: '`info()` 打印 DataFrame 的摘要信息。重点看「非空数量」列——它小于总行数就说明该列有缺失值。'
  },
  'describe': {
    what: '查看数值列的统计摘要（计数、均值、标准差、四分位数）',
    principle: '`describe()` 对每个数值列计算 count/mean/std/min/25%/50%/75%/max，一次看清数据的分布范围和异常量级。'
  },
  'dtypes': {
    what: '查看每一列的数据类型',
    principle: '`dtypes` 返回每列的类型（int64 / float64 / object 等）。object 通常意味着这列是字符串，需要先转换成数值才能参与计算。'
  },
  'shape': {
    what: '查看数据的行列数',
    principle: '`shape` 返回 `(行数, 列数)` 元组。常用来确认删除操作前后少了多少行。'
  },

  // ── 缺失值 ──
  'isnull': {
    what: '逐格判断是否为空值，得到一张布尔表',
    principle: '`isnull()`（等价 `isna()`）对每个单元格判断是否为 NaN/None，返回同形状的 True/False 表。它本身不删除任何数据，只是标记，通常后面接 `.sum()` 按列统计缺失个数。'
  },
  'isna': {
    what: '逐格判断是否为空值，得到一张布尔表',
    principle: '`isna()` 与 `isnull()` 完全等价，对每个单元格判断是否为 NaN/None，返回 True/False 表。接 `.sum()` 就能按列数出缺失个数。'
  },
  'notnull': {
    what: '逐格判断是否非空，得到一张布尔表',
    principle: '`notnull()` 是 `isnull()` 取反，常用于布尔索引筛选出有效行。'
  },
  'sum': {
    what: '对布尔表按列求和，得到每列的缺失值/重复值个数',
    principle: 'Python 里 `True` 当 1、`False` 当 0，所以对布尔表调用 `sum()` 等价于「数有多少个 True」。默认 `axis=0` 沿行方向压缩，即按列统计。'
  },
  'dropna': {
    what: '删除含有缺失值的行',
    principle: '`dropna()` 默认丢弃任何含有 NaN 的行；`subset=[列名]` 只按指定列判断，`how="all"` 则要求整行全空才丢。会返回新对象，所以要写 `data = data.dropna()` 才生效。'
  },
  'fillna': {
    what: '把缺失值替换成指定内容',
    principle: '`fillna(x)` 把所有 NaN 换成 x，可传常数、均值或字典（按列分别填充）。相比直接删除，填充能保留样本量。'
  },
  'pd.to_numeric': {
    what: '把一列强制转换成数值类型，转换不了的置为 NaN',
    principle: '`pd.to_numeric()` 尝试把字符串解析成数字；`errors="coerce"` 表示解析失败时置为 NaN 而不是报错。这是清洗「数字被存成文本」这类脏数据的标准手法，之后再 dropna 即可剔除异常值。'
  },
  'astype': {
    what: '把列的数据类型转换成指定类型',
    principle: '`astype(int)` / `astype(float)` 做强制类型转换。要求列内所有值都能转换，否则抛错——所以一般先确认没有 NaN 和脏字符串。'
  },

  // ── 重复值 ──
  'drop_duplicates': {
    what: '删除完全重复的行',
    principle: '`drop_duplicates()` 按所有列（或 `subset` 指定的列）比较，保留第一次出现的行、丢掉后续重复的。返回新对象，需重新赋值。'
  },
  'duplicated': {
    what: '标记出哪些行是重复行',
    principle: '`duplicated()` 返回布尔 Series，首次出现的行是 False，之后重复的行是 True。接 `.sum()` 可数出重复行数，也常配合 `~` 反选来过滤。'
  },

  // ── 统计与分组 ──
  'value_counts': {
    what: '对某一列做分组计数',
    principle: '`value_counts()` 自动统计 Series 中每个取值出现的次数，返回「取值 → 次数」的 Series，默认按次数从多到少排序。是算类别分布、占比分母最常用的方法。'
  },
  'groupby': {
    what: '按某列的值把数据分组，为后续聚合做准备',
    principle: '`groupby()` 是「拆分—应用—合并」模式：先按分组键把行拆成若干组，对每组施加聚合函数，再把结果拼回一张表。它本身不返回结果，必须接 `.agg()` / `.mean()` 之类的聚合才有输出。'
  },
  'agg': {
    what: '对分组结果施加聚合函数',
    principle: '`agg()` 接受函数名或函数列表（如 `["sum","mean"]`），对每个分组分别计算并汇总成新表。配合 groupby 使用，是分组统计的输出环节。'
  },
  'mean': {
    what: '求平均值',
    principle: '`mean()` 对数值序列求算术平均。在标准化公式里 `(x - mean) / std` 是中心化步骤，把数据整体平移到以 0 为中心。'
  },
  'std': {
    what: '求标准差',
    principle: '`std()` 衡量数据的离散程度（默认样本标准差，除以 n-1）。标准化公式的分母就是它，用来把不同量纲的列拉到同一尺度。'
  },
  'quantile': {
    what: '求分位数，用来定位箱线图的四分位点',
    principle: '`quantile(0.25)` / `quantile(0.75)` 返回下四分位 Q1 和上四分位 Q3。IQR 异常值检测就是建立在 Q1、Q3 之上的。'
  },
  'unique': {
    what: '列出该列所有不重复的取值',
    principle: '`unique()` 返回去重后的数组（顺序为首次出现顺序），用来快速了解一个类别列有哪些取值。'
  },
  'nunique': {
    what: '统计有多少个不重复的取值',
    principle: '`nunique()` 返回去重后的个数，比 `len(unique())` 更直接，常用来判断某列是不是类别列。'
  },
  'len': {
    what: '求长度（行数或元素个数）',
    principle: '`len()` 是 Python 内置函数，对 DataFrame 返回行数、对 Series 返回元素个数，常用来算样本量。'
  },

  // ── 变换与选择 ──
  'apply': {
    what: '把某个函数逐行/逐元素地应用到数据上',
    principle: '`apply()` 遍历 Series 的每个元素（或 DataFrame 的每行/每列）并施加传入的函数。适合做自定义转换，比如把一个字符串按空格切分后取第一段转成整数。'
  },
  'map': {
    what: '按映射关系替换取值，或对每个元素施加函数',
    principle: '`map()` 对 Series 逐个元素查字典或调用函数，把原值替换成新值。适合把类别文本编码成数字。'
  },
  'replace': {
    what: '把指定的值替换成另一个值',
    principle: '`replace(旧值, 新值)` 做精确匹配替换，可传字典批量替换。与 map 的区别是 replace 只改匹配上的值，其余保持原样。'
  },
  'drop': {
    what: '删除指定的行或列',
    principle: '`drop(columns=[...])` 删列，`drop(index=[...])` 删行。默认返回新对象不修改原数据，要写 `data = data.drop(...)` 才生效。'
  },
  'rename': {
    what: '重命名列名或索引',
    principle: '`rename(columns={旧:新})` 只改指定列的名字，其余不动，比整体重设 columns 更安全。'
  },
  'astype': {
    what: '转换数据类型',
    principle: '`astype(类型)` 强制转换列类型，要求所有值都能转成功。'
  },
  'sort_values': {
    what: '按某列的值排序',
    principle: '`sort_values(by=列名, ascending=False)` 降序排列，常用来找出最大值/最高分组。'
  },
  'reset_index': {
    what: '把索引重置成默认的 0,1,2…',
    principle: '`reset_index()` 把当前索引变成普通列并生成新索引；`drop=True` 则直接丢弃旧索引。分组聚合后索引会变成分组键，常需要它拉平。'
  },
  'isin': {
    what: '判断每个值是否落在给定集合里',
    principle: '`isin([...])` 返回布尔 Series，用来做「某列属于这几类」的筛选条件。'
  },

  // ── 分箱 ──
  'pd.cut': {
    what: '把连续的数值按指定的边界切分成离散区间',
    principle: '`pd.cut(x, bins=[...], labels=[...])` 按你给定的边界划分区间（等宽分箱）。关键参数是 `right`：默认 `right=True` 表示区间左开右闭 `(a, b]`；`right=False` 则变成左闭右开 `[a, b)`。边界包含关系直接影响临界值落到哪一箱，是这题最容易错的地方。'
  },
  'pd.qcut': {
    what: '按分位数把数据等量切分成若干组',
    principle: '`pd.qcut(x, q)` 按累计频率切分（等频分箱），保证每组样本量大致相同。与 `pd.cut` 的等宽分箱相对——数据分布倾斜时 qcut 更均衡。'
  },

  // ── 合并与透视 ──
  'merge': {
    what: '按共同的键把两张表横向拼接起来',
    principle: '`merge()` 类似 SQL JOIN，`how="left"` 保留左表全部行、右表没匹配上的补 NaN。要求键列语义一致。'
  },
  'concat': {
    what: '把多张表沿某个方向拼接起来',
    principle: '`pd.concat([...], axis=1)` 按列横向拼接（对齐索引），`axis=0` 则纵向追加行。与 merge 的区别是 concat 靠索引对齐，不做键匹配。'
  },
  'pivot_table': {
    what: '生成透视表，把长表变宽表做交叉汇总',
    principle: '`pivot_table(index=, columns=, values=, aggfunc=)` 按行键和列键分组，再用聚合函数汇总数值，适合做多维交叉分析。'
  },
  'crosstab': {
    what: '统计两个类别列的交叉频数表',
    principle: '`crosstab()` 计算两个分类变量的列联表，默认 `normalize` 可切换成占比，是分析类别间关联的常用工具。'
  },
  'pd.get_dummies': {
    what: '把类别列做独热编码，展开成多个 0/1 列',
    principle: '`pd.get_dummies()` 为每个类别生成一个指示列（属于该类别为 1，否则 0）。这一步是必须的，因为模型只能吃数值，无法直接处理字符串类别。'
  },

  // ── 预处理与建模 ──
  'train_test_split': {
    what: '把数据按比例随机拆成训练集和测试集',
    principle: '`train_test_split(X, y, test_size=0.2, random_state=42)` 返回四个对象 `X_train, X_test, y_train, y_test`，顺序固定不能接错。`test_size` 指定测试集占比，`random_state` 固定随机种子保证每次拆分结果一致、实验可复现。'
  },
  'StandardScaler': {
    what: '创建标准化转换器（把每列变成均值 0、标准差 1）',
    principle: '标准化公式是 `(x - 均值) / 标准差`。它让量纲差异巨大的特征（比如年龄和收入）在模型里权重公平——否则数值大的列会主导距离计算。'
  },
  'fit_transform': {
    what: '先拟合统计量（均值、标准差），再对数据做转换',
    principle: '`fit_transform()` 等于 `fit()` + `transform()` 两步合一步：先从数据里算出均值和标准差，再用这两个数去转换。注意只能对训练集 fit，测试集必须复用同一个转换器的 `transform()`，否则会造成数据泄漏。'
  },
  'MinMaxScaler': {
    what: '创建归一化转换器（把每列线性缩放到 0~1）',
    principle: '归一化公式是 `(x - min) / (max - min)`，把数据压缩到固定区间 [0,1]。与标准化相比，它保留原始分布形状但受极值影响更大。'
  },
  'LinearRegression': {
    what: '创建线性回归模型实例',
    principle: '线性回归假设目标值是特征的线性组合，通过最小化残差平方和求系数。创建实例只是定义模型，还需要 `.fit()` 才真正训练。'
  },
  'LogisticRegression': {
    what: '创建逻辑回归模型实例（用于二分类）',
    principle: '逻辑回归在线性组合外套一层 sigmoid 函数，把输出压到 0~1 当作概率，是分类任务最常用的基线模型。`max_iter` 控制求解迭代上限，数据未标准化时容易不收敛。'
  },
  'RandomForestRegressor': {
    what: '创建随机森林回归模型实例',
    principle: '随机森林由多棵决策树组成，每棵树在随机抽样的数据和特征上训练，最后对结果取平均。`n_estimators` 指定树的数量；树越多越稳但越慢。'
  },
  'LinearRegression': {
    what: '创建线性回归模型实例',
    principle: '线性回归通过最小化预测值与真实值的平方误差来求解系数。'
  },
  'fit': {
    what: '用训练数据训练模型（学习参数）',
    principle: '`fit(X_train, y_train)` 是模型的训练入口：拿特征和目标值反复迭代，调整内部参数使预测误差最小。这一步之后模型才具备预测能力。'
  },
  'predict': {
    what: '用训练好的模型对新数据做预测',
    principle: '`predict(X_test)` 把特征输入模型，输出预测值。注意传入的特征列顺序和数量必须与训练时完全一致。'
  },
  'score': {
    what: '计算模型在给定数据上的评分（回归默认 R²）',
    principle: '`score(X, y)` 对回归模型返回决定系数 R²（越接近 1 拟合越好），对分类模型返回准确率。分别对训练集和测试集调用，可以对比判断有没有过拟合。'
  },
  'mean_squared_error': {
    what: '计算均方误差（预测值与真实值差的平方的平均）',
    principle: 'MSE 把每个样本的误差平方后取平均。平方放大了大误差的权重，所以 MSE 对离群点敏感，单位是原单位的平方。'
  },
  'r2_score': {
    what: '计算决定系数 R²，衡量模型解释了多大比例的方差',
    principle: 'R² = 1 - 残差平方和/总平方和。取值越接近 1 说明拟合越好，等于 0 相当于只用均值预测，为负则比均值还差。'
  },
  'smote': {
    what: '对少数类做过采样，缓解类别不平衡',
    principle: 'SMOTE 在少数类样本之间做线性插值，合成新的少数类样本，让各类样本量接近。必须在划分训练集之后、只对训练集做，否则测试集会被污染。'
  },

  // ── 保存与序列化 ──
  'to_csv': {
    what: '把 DataFrame 写出成 CSV 文件',
    principle: '`to_csv(路径, index=False)` 逐行写出数据。`index=False` 表示不把行号也写成一列——不加这个参数会多出一列无名索引，是这题常见的扣分点。'
  },
  'to_excel': {
    what: '把 DataFrame 写出成 Excel 文件',
    principle: '`to_excel(路径, index=False)` 写出 xlsx 文件，同样建议关掉索引列。'
  },
  'dump': {
    what: '把训练好的模型序列化保存成文件',
    principle: '`pickle.dump(对象, 文件句柄)` 把 Python 对象转成字节流写入文件，之后可以用 `pickle.load()` 还原。这样训练结果能跨程序复用，不用每次重新训练。'
  },

  // ── NumPy ──
  'np.where': {
    what: '按条件生成新值（向量化的 if-else）',
    principle: '`np.where(条件, 满足时的值, 不满足时的值)` 对整个数组逐元素判断并返回同形状结果，比写循环快得多。它是创建衍生类别列（如风险等级）最直接的方式。'
  },
  'np.array': {
    what: '把列表转换成 NumPy 数组',
    principle: '`np.array()` 把 Python 列表变成 ndarray，才能用 NumPy 的向量化运算和广播。'
  },
  'np.argmax': {
    what: '找出最大值所在的位置（下标）',
    principle: '`np.argmax()` 返回最大值第一次出现的下标，而不是最大值本身。在分类任务里，模型输出各类别的概率，用 argmax 取概率最大的那个下标就得到预测类别。'
  },
  'np.argsort': {
    what: '返回排序后的下标顺序',
    principle: '`np.argsort()` 返回「按值从小到大排好后，各元素原来的下标」。所以取 `[::-1][:5]` 就能拿到概率最高的前 5 个类别的下标。'
  },
  'np.expand_dims': {
    what: '在指定位置增加一个维度',
    principle: '`np.expand_dims(x, axis=0)` 给数组加一维。深度学习模型通常要求输入是「批 × 高 × 宽 × 通道」四维张量，单张图片只有三维，所以要补一个批次维度。'
  },
  'np.mean': {
    what: '求平均值',
    principle: '`np.mean()` 对整个数组或指定轴求均值，是向量化版本，比 Python 循环快。'
  },

  // ── 可视化 ──
  'plt.figure': {
    what: '新建一张画布，并设定整体尺寸',
    principle: '`plt.figure(figsize=(宽, 高))` 创建新的图形对象，`figsize` 单位是英寸。不先建画布的话，多个子图会画到一起。'
  },
  'subplot': {
    what: '在画布上划分出子图位置',
    principle: '`plt.subplot(行, 列, 序号)` 把画布切成网格并激活第 n 个格子（从 1 开始编号）。配合循环的 `enumerate` 可以把多列一次性画成小多图。'
  },
  'boxplot': {
    what: '绘制箱线图，展示数据分布和离群点',
    principle: '箱线图用箱体标出 Q1~Q3（中间 50% 的数据范围）、中位数横线，上下须延伸到 1.5 倍 IQR 内的极值，超出的点单独画成离群点。正因为能直观看出异常值，它常作为异常值检测的第一张图。'
  },
  'hist': {
    what: '绘制直方图，看数值的分布形态',
    principle: '`hist(bins=)` 把数值范围切成若干区间并统计每区间频数，用来判断分布是否偏态、有没有双峰。'
  },
  'scatter': {
    what: '绘制散点图，观察两个变量的关系',
    principle: '`scatter(x, y)` 把每个样本画成一个点，用来初步判断两个变量是否线性相关、有没有聚集或离群。'
  },
  'tight_layout': {
    what: '自动调整子图间距，避免标签重叠',
    principle: '`plt.tight_layout()` 根据坐标轴标签的实际尺寸重新计算边距，解决子图标题/轴标签互相遮挡的问题。'
  },
  'show': {
    what: '渲染并显示图形',
    principle: '`plt.show()` 把内存中的图形对象真正画出来。不调用它，前面的绘制代码不会有任何输出。'
  },

  // ── 图像 / 深度学习 ──
  'cv2.imread': {
    what: '读取图片文件成 NumPy 数组',
    principle: '`cv2.imread()` 把图片解码成「高 × 宽 × 通道」的三维数组。注意 OpenCV 默认按 BGR 顺序排列通道，而多数模型要求 RGB，所以读入后通常要转换通道顺序。'
  },
  'cv2.cvtColor': {
    what: '转换图像的颜色空间',
    principle: '`cv2.cvtColor(img, cv2.COLOR_BGR2RGB)` 把 BGR 通道顺序改成 RGB。不做这步的话红蓝会颠倒，模型识别结果会明显变差。'
  },
  'cv2.resize': {
    what: '把图像缩放到指定尺寸',
    principle: '`cv2.resize(img, (宽, 高))` 改变图像分辨率。注意参数顺序是「宽, 高」，与数组的「高, 宽」相反，是常见错误点。模型对输入尺寸有硬性要求，所以必须统一缩放。'
  },
  'InferenceSession': {
    what: '加载 ONNX 模型文件，创建推理会话',
    principle: '`ort.InferenceSession(路径)` 把 ONNX 模型读进内存并准备好计算图。会话对象负责真正执行推理，加载后可用 `get_inputs()` 查看模型要求的输入名和形状。'
  },
  'get_inputs': {
    what: '获取模型的输入信息（名称、形状、类型）',
    principle: '`session.get_inputs()` 返回输入描述列表，取 `[0].name` 得到输入节点名。推理时传给 `run()` 的字典键必须用这个名字。'
  },
  'run': {
    what: '执行模型推理，得到输出',
    principle: '`session.run(输出名, {输入名: 数据})` 前向计算一次。第一个参数传 `None` 表示取全部输出，第二个参数是把输入名映射到数据的字典。'
  },
  'softmax': {
    what: '把模型输出的原始分数转换成概率分布',
    principle: 'softmax 对每个分数取指数后归一化，使所有输出之和为 1，且保持大小顺序。模型最后一层输出的 raw logits 要经过它才能解释成「属于各类别的概率」。'
  },
  'Image.open': {
    what: '用 PIL 打开图片文件',
    principle: '`Image.open()` 读取图片元数据并返回图像对象（惰性加载，真正读取像素在后续操作时）。'
  },

  // ── 字符串 ──
  'strip': {
    what: '去掉字符串首尾的空白字符',
    principle: '`strip()` 移除首尾空格、制表符、换行符（不改中间）。列名或类别值前后带空格会导致分组时被当成不同类别，所以清洗阶段必须处理。'
  },
  'str.contains': {
    what: '判断字符串中是否包含指定子串',
    principle: '`str.contains(模式)` 逐元素做子串匹配，返回布尔 Series，支持正则。常用来做文本筛选。'
  },
  'str.replace': {
    what: '替换字符串中的内容',
    principle: '`str.replace(旧, 新)` 逐元素替换子串，默认支持正则，可用来清掉单位、符号等噪声。'
  },
  'str.split': {
    what: '按分隔符把字符串切开',
    principle: '`str.split(分隔符)` 把每个字符串拆成列表，配合 `str[0]` 或 `.str[1]` 可以取出其中一段，例如从「30-35岁」里取出起始年龄。'
  }
}

/** 别名：把答案里出现的写法映射到知识库键 */
const ALIAS = {
  'np.argmax': 'np.argmax',
  'argsort': 'np.argsort',
  'pd.to_numeric': 'pd.to_numeric',
  'to_numeric': 'pd.to_numeric',
  'scipy.special.softmax': 'softmax',
  'special.softmax': 'softmax',
  'onnxruntime.InferenceSession': 'InferenceSession',
  'ort.InferenceSession': 'InferenceSession',
  'ort_session.run': 'run',
  'session.run': 'run',
  'ort_session.get_inputs': 'get_inputs',
  'pickle.dump': 'dump',
  'fit_transform': 'fit_transform',
  'train_test_split': 'train_test_split',
  'StandardScaler': 'StandardScaler',
  'MinMaxScaler': 'MinMaxScaler',
  'LinearRegression': 'LinearRegression',
  'LogisticRegression': 'LogisticRegression',
  'RandomForestRegressor': 'RandomForestRegressor',
  'XGBRegressor': 'XGBRegressor',
  'XGBClassifier': 'XGBClassifier',
  'DecisionTreeRegressor': 'DecisionTreeRegressor',
  'mean_squared_error': 'mean_squared_error',
  'r2_score': 'r2_score',
  'SMOTE': 'smote',
  'fit_resample': 'smote',
  'LabelEncoder': 'LabelEncoder',
  'get_dummies': 'pd.get_dummies',
  'to_csv': 'to_csv',
  'to_excel': 'to_excel',
  'value_counts': 'value_counts',
  'groupby': 'groupby',
  'dropna': 'dropna',
  'drop_duplicates': 'drop_duplicates',
  'duplicated': 'duplicated',
  'isnull': 'isnull',
  'isna': 'isna',
  'astype': 'astype',
  'apply': 'apply',
  'applymap': 'apply',
  'cvtColor': 'cv2.cvtColor',
  'imread': 'cv2.imread',
  'resize': 'cv2.resize',
  'crop': 'cv2.resize',
  'predict': 'predict',
  'score': 'score',
  'fit': 'fit',
  'read_csv': 'pd.read_csv',
  'read_excel': 'pd.read_excel',
  'cut': 'pd.cut',
  'qcut': 'pd.qcut'
}

// 补充几条在 ALIAS 里出现但知识库缺的
API_GUIDE['XGBRegressor'] = {
  what: '创建 XGBoost 回归模型实例',
  principle: 'XGBoost 是梯度提升树：一棵棵地串行训练决策树，每棵新树专门拟合前面所有树的残差，逐步逼近真实值。`n_estimators` 是树的数量，`learning_rate` 控制每棵树的贡献权重（越小越稳但需要更多树），`max_depth` 限制单棵树复杂度以防过拟合。'
}
API_GUIDE['XGBClassifier'] = {
  what: '创建 XGBoost 分类模型实例',
  principle: '梯度提升用于分类任务时，每棵新树拟合当前预测概率的梯度残差，最终输出各类别概率。'
}
API_GUIDE['DecisionTreeRegressor'] = {
  what: '创建决策树回归模型实例',
  principle: '决策树通过不断选择最优特征和切分点，把样本递归划分到叶子节点，用叶子内样本均值作为预测值。可解释性强但单棵树容易过拟合。'
}
API_GUIDE['LabelEncoder'] = {
  what: '创建标签编码器（把类别文本映射成 0,1,2…）',
  principle: '`LabelEncoder` 按字典序给每个类别分配一个整数编号，用 `fit_transform()` 一步完成学习映射表并转换。注意它假设类别间有大小顺序，无序类别更适合独热编码。'
}

/** 从答案文本里识别用到的 API（返回最匹配的知识库键） */
export function detectApi(answer) {
  const text = String(answer || '')
  const candidates = []
  for (const key of Object.keys(ALIAS)) {
    if (text.includes(key)) candidates.push({ key: ALIAS[key], len: key.length })
  }
  for (const key of Object.keys(API_GUIDE)) {
    if (text.includes(key)) candidates.push({ key, len: key.length })
  }
  if (!candidates.length) return null
  // 取匹配到的最长写法，避免 `sum` 抢先于 `value_counts().sum()`
  candidates.sort((a, b) => b.len - a.len)
  return candidates[0].key
}

/** 清理题目注释，去掉分值后缀和编号前缀 */
export function cleanHint(hint) {
  return String(hint || '')
    .replace(/\s*\d+\s*分\s*$/, '')
    .replace(/^\s*\d+[.、]\s*/, '')
    .replace(/^#+\s*/, '')
    .trim()
}

/** 不是函数调用的名字，展示时不加括号 */
const NON_CALL = new Set(['dtypes', 'shape', 'columns', 'values', 'size'])

/** 兜底：识别「不是 API 调用」的常见答案形态 */
function detectPattern(answer) {
  const a = String(answer || '').trim()

  // 关键字参数：test_size=0.2 / index=False / bins=age_bins
  const kw = a.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/)
  if (kw && PARAM_GUIDE[kw[1]] && !a.includes('(')) {
    return {
      label: `参数 ${kw[1]}`,
      what: `给上一步的函数传入参数 \`${kw[1]}\``,
      principle: PARAM_GUIDE[kw[1]]
    }
  }

  // 纯变量引用：data / image / cleaned_data
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(a)) {
    return {
      label: '变量引用',
      what: '引用前面步骤里已经定义好的变量',
      principle: '这里不需要重新构造数据，直接把上面某一步算出来的变量拿过来用即可。变量名必须与它定义时完全一致（大小写敏感），拼错会直接 NameError。'
    }
  }

  // 字符串字面量：'cleaned_credit_data.csv' / 'Gender'
  if (/^['"][^'"]+['"]$/.test(a)) {
    return {
      label: '字面量',
      what: '填一个具体的取值',
      principle: '这里的引号、大小写、空格都必须与题目要求逐字符一致——文件名写错会导致后续读不到文件，列名写错会 KeyError。'
    }
  }

  // 取一列：data['列名'] / df["列名"]
  if (/^[\w.]+\[\s*['"][^'"]+['"]\s*\]$/.test(a)) {
    return {
      label: '列选择',
      what: '按列名取出一列（Series），作为后续统计或建模的输入',
      principle: '`DataFrame["列名"]` 用方括号加列名取列。取单列返回 Series，取多列要传列表（`df[["a","b"]]`）返回 DataFrame。列名必须与表头完全一致，含空格或特殊符号时引号不能省。'
    }
  }
  // 取多列：data[['a','b']]
  if (/^[\w.]+\[\s*\[.*\]\s*\]$/.test(a)) {
    return {
      label: '多列选择',
      what: '按列名一次取出多列，组成一个子表',
      principle: '`df[["a","b"]]` 的双层方括号：外层是索引操作，内层是列名列表。返回的仍是 DataFrame，常用于挑出参与建模的特征列。'
    }
  }
  // 特征列表
  if (/^\[.*\]$/.test(a)) {
    return {
      label: '列表字面量',
      what: '列出要使用的列名，供后续按名取数',
      principle: '方括号里是 Python 列表，每个元素都必须和表头里的列名逐字符一致（大小写、空格、单位符号都不能差）。列表常用于批量选列或作为 `columns=` 参数。'
    }
  }
  // 布尔条件
  if (/[<>]=?|==|!=/.test(a) && !a.includes('(')) {
    return {
      label: '条件表达式',
      what: '构造一个逐行判断的布尔条件',
      principle: '比较运算符作用在整列上会逐元素求值，返回布尔 Series。它通常作为筛选条件（布尔索引）或 `np.where` 的第一个参数使用。'
    }
  }
  // 纯算术
  if (/^[\w.'"\[\]\s]+[-+*/][\w.'"\[\]\s]+$/.test(a)) {
    return {
      label: '算式',
      what: '对列做四则运算',
      principle: 'pandas 的运算是向量化的，整列一起算，无需写循环。参与运算的列必须都是数值类型，否则要先做类型转换。'
    }
  }
  return null
}

/**
 * 生成「功能解析」文案
 * @param {string} answer  该空的标准答案
 * @param {string} hint    该空的题目注释
 * @returns {{ api:string|null, text:string }}
 */
export function explainBlank(answer, hint) {
  const purpose = cleanHint(hint) || '完成本行代码要求的数据处理'
  const api = detectApi(answer)
  const guide = api ? API_GUIDE[api] : null

  if (guide) {
    const shown = NON_CALL.has(api) ? `\`${api}\`` : `\`${api}()\``
    return {
      api,
      text: [
        `这行代码使用 ${shown}，${guide.what}。`,
        '',
        `业务目的：${purpose}。`,
        `原理：${guide.principle}`
      ].join('\n')
    }
  }

  const pattern = detectPattern(answer)
  if (pattern) {
    return {
      api: null,
      text: [
        `这行代码属于「${pattern.label}」，${pattern.what}。`,
        '',
        `业务目的：${purpose}。`,
        `原理：${pattern.principle}`
      ].join('\n')
    }
  }

  // 知识库未覆盖：退化为「这行代码在做什么 + 自查方式」
  return {
    api: null,
    text: [
      `这行代码填的是 \`${String(answer).trim()}\`，用于${purpose}。`,
      '',
      `业务目的：${purpose}。`,
      '原理：按题目注释给出的功能要求，这里需要调用对应的 pandas / numpy 方法完成该步骤；'
      + '把填好的代码跑一遍，确认输出结果与题目要求的表格/数值一致即可。'
    ].join('\n')
  }
}

/** 各 API 的高频错误点 */
const MISTAKE_GUIDE = {
  'pd.read_csv': ['文件名漏了扩展名或引号', '路径写成绝对路径导致在其他机器上找不到文件'],
  'value_counts': ['写成 `count()`（那是按列统计非空个数，不是按取值计数）', '忘了它返回的是 Series，直接当 DataFrame 用'],
  'groupby': ['只写了 `groupby()` 没接聚合函数，拿不到结果', '分组键列名拼错，或分组后又忘了 `reset_index()`'],
  'dropna': ['忘了重新赋值：`data.dropna()` 不会修改原数据', '不加 `subset` 导致误删了其他列有缺失但本列有效的行'],
  'drop_duplicates': ['忘了重新赋值', '误用 `keep="last"` 改变了保留策略'],
  'pd.to_numeric': ['忘了写 `errors="coerce"`，遇到脏字符串直接报错中断', '转换后忘了再 `dropna()` 清理产生的 NaN'],
  'astype': ['列里有 NaN 时 `astype(int)` 会直接报错', '拼接顺序写反，导致原数据被覆盖'],
  'np.where': ['三个参数顺序写错（条件、真值、假值）', '两个分支的取值写反，导致高低风险颠倒'],
  'pd.cut': ['忘了 `right=False`，导致临界值落进相邻区间', '`bins` 边界少一个数（n 个区间需要 n+1 个边界）', '`labels` 个数与区间个数不一致'],
  'train_test_split': ['四个返回值的接收顺序写错（必须是 X_train, X_test, y_train, y_test）', '`test_size` 与题目要求比例不符（如题目要 8:2 却写了 0.3）', '漏写 `random_state`，每次运行结果不一样'],
  'StandardScaler': ['只对训练集 `fit_transform`，测试集又新建了一个 scaler（应复用同一个）', '忘了写 `data[numerical_features] =` 把结果赋回去'],
  'fit_transform': ['直接在测试集上也 `fit_transform`，造成数据泄漏', '漏写赋值，转换结果被丢弃'],
  'fit': ['把测试集也传进去训练', '特征列顺序与预测时不一致'],
  'predict': ['传入了没有经过同样预处理的原始数据', '接收变量名与后续代码不匹配'],
  'score': ['训练集和测试集传反了', '对回归模型误以为是准确率（回归返回的是 R²）'],
  'to_csv': ['忘了 `index=False`，多出一列无名行号', '文件名与题目要求的不一致'],
  'dump': ['文件模式没写 `"wb"`（二进制写）', '忘了传文件句柄，直接传了文件名字符串'],
  'np.argmax': ['误以为返回最大值本身（实际返回下标）', '没指定 `axis`，多维时结果不符合预期'],
  'np.argsort': ['忘了取 `[::-1]` 做降序，拿到的是最小而非最大的', '切片写成 `[:5]` 而不是 `[::-1][:5]`'],
  'np.expand_dims': ['`axis` 传错，批次维加到了错误位置'],
  'softmax': ['把 raw logits 直接当概率用', '忘了指定 `axis`，多维时归一化方向错了'],
  'cv2.resize': ['`(宽, 高)` 顺序写反', '改变了通道数导致后续模型输入不匹配'],
  'cv2.cvtColor': ['通道转换方向写反（应是 BGR2RGB）'],
  'InferenceSession': ['模型文件路径写错', '忘了 `sess_options` 之类的可选参数不影响结果，但路径必须对'],
  'run': ['字典的键不是模型要求的输入名（应取 `get_inputs()[0].name`）', '第一个参数传了输出名列表而非 `None`'],
  'mean_squared_error': ['参数顺序写反（先真实值后预测值）', '误把 MSE 当成越小越好的 R² 来解读'],
  'r2_score': ['参数顺序写反', '把负的 R² 误判为正常'],
  'pd.get_dummies': ['忘了指定要编码的列', '编码后列数膨胀，忘了与数值列合并'],
  'smote': ['在划分训练集之前就做了过采样，污染测试集', '对测试集也做了重采样'],
  'pd.read_excel': ['忘了指定 `sheet_name`，读到了错误的工作表', '文件名后缀与实际格式不符'],
  'plt.figure': ['忘了写 `figsize`，子图挤在一起'],
  'subplot': ['行列数与序号不匹配，导致子图重叠'],
  'boxplot': ['把整个 DataFrame 直接传进去，导致不同量纲的列画在同一刻度上'],
  'mean': ['对含有 NaN 的列求均值（pandas 会自动跳过 NaN，但要确认这是期望行为）'],
  'std': ['误用总体标准差（pandas 默认是样本标准差，除以 n-1）'],
  'quantile': ['分位数写错（Q1 是 0.25，Q3 是 0.75）'],
  'apply': ['忘了 `lambda` 或函数名拼错', '对 DataFrame 用 apply 时没指定 `axis`'],
  'merge': ['`how` 参数选错（left / inner / outer 结果行数差很多）', '两表键列名不一致时忘了写 `left_on` / `right_on`'],
  'concat': ['`axis` 方向搞反（0 是纵向追加，1 是横向拼接）']
}

/** 通用兜底错误点 */
const GENERIC_MISTAKES = [
  '函数名拼写错误（注意大小写与下划线）',
  '漏写括号或引号',
  '参数顺序写反'
]

/**
 * 生成「常见错误点」文案
 * @param {string|null} api detectApi 的结果
 */
export function mistakesFor(api) {
  const specific = (api && MISTAKE_GUIDE[api]) || []
  const merged = [...specific, ...GENERIC_MISTAKES]
  return merged.slice(0, 3).join('；')
}

/** 关键字参数说明（答案形如 `test_size=0.2` 时用） */
const PARAM_GUIDE = {
  test_size: '测试集占总数据的比例，`0.2` 表示划出 20% 做测试',
  train_size: '训练集占比，`0.8` 表示 80% 用于训练（与 test_size 互补）',
  random_state: '随机种子。固定后每次运行划分结果完全一致，保证实验可复现',
  n_estimators: '集成模型里决策树的数量。越多越稳定但训练越慢',
  estimator: '树的数量（XGBoost 的写法，含义同 n_estimators）',
  learning_rate: '每棵新树对最终结果的贡献权重。越小越稳，但需要更多棵树',
  max_depth: '单棵树的最大深度，用来限制模型复杂度、防止过拟合',
  index: '是否把行号也写成一列。`False` 表示不写，避免多出一列无名索引',
  sep: '字段分隔符，`"\\t"` 表示用制表符分隔',
  bins: '分箱的边界列表或区间定义，n 个区间需要 n+1 个边界值',
  labels: '每个区间对应的标签名，个数必须与区间数一致',
  right: '区间开闭方向。`False` 表示左闭右开 `[a, b)`，决定边界值落到哪一箱',
  method: '填充方向。`"ffill"` 用前一个有效值向后填充，`"bfill"` 用后一个有效值向前填充',
  errors: '类型转换失败时的处理方式。`"coerce"` 表示置为 NaN 而不是报错',
  axis: '运算方向。`0` 沿行方向（按列统计），`1` 沿列方向（按行统计）',
  subset: '只在这些列上判断缺失值，其余列不参与',
  columns: '要操作的列名列表',
  inplace: '是否直接修改原对象而不返回新对象',
  max_iter: '求解器的最大迭代次数，数据未标准化时容易达到上限而不收敛',
  drop: '是否丢弃原索引（`True` 表示不保留为列）',
  ascending: '排序方向，`False` 表示降序',
  normalize: '是否把频数换算成占比',
  q: '分位数的位置，如 `0.25` 表示下四分位',
  sheet_name: '要读取的工作表名称'
}

/** 补充：常见但此前缺失的 API */
API_GUIDE['between'] = {
  what: '判断每个值是否落在闭区间 [下界, 上界] 内',
  principle: '`Series.between(a, b)` 逐元素判断是否满足 `a <= x <= b`，两端都包含，返回布尔 Series。做数值合理性审核时，它比手写 `(x >= a) & (x <= b)` 更简洁，也不容易漏掉边界。'
}
API_GUIDE['ffill'] = {
  what: '用前一个有效值向后填充缺失',
  principle: '`ffill`（forward fill）假设数据沿时间顺序连续，缺失处沿用上一个已知值。适合时间序列；若数据无序，这种填充会引入错误信息。'
}
API_GUIDE['bfill'] = {
  what: '用后一个有效值向前填充缺失',
  principle: '`bfill`（backward fill）与前向填充相反，用缺失点之后第一个有效值回填。常用于末尾缺失的场景。'
}

export { API_GUIDE, MISTAKE_GUIDE, PARAM_GUIDE }
